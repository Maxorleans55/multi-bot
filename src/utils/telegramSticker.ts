import { spawn } from 'child_process';
import type { Dirent } from 'fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, extname, join } from 'path';
import { log } from './logger.js';

// ---------------------------------------------------------------------------
// TStickers (https://github.com/FHPythonUtils/TStickers) — Python CLI that
// downloads & converts Telegram sticker packs (https://t.me/addstickers/...)
// into multiple formats including WhatsApp-ready .webp files.
//
// Output layout (inside the working directory):
//   downloads/<pack>/webp/*.webp   ← WhatsApp-compatible static stickers
//   downloads/<pack>/webm/*.webm   ← animated stickers (needs webp conversion)
//   downloads/<pack>/tgs/*.tgs     ← animated Telegram stickers (raw)
//   downloads/<pack>/gif|png|apng  ← other converted formats
//
// Priority when building the WhatsApp sticker pack:
//   1. WebP output (WhatsApp-ready, static & animated) — primary.
//   2. WebM output → converted to animated WebP via ffmpeg.
//   3. Any sticker-ish image (.png/.jpg/.gif) as a last resort.
//
// Security note: the CLI reads the bot token from an `env` file in its working
// directory. We write the token there instead of passing `-t <token>` so it
// never appears in the process argument list (visible in task managers).
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 300_000; // TStickers conversion can be slow (60s+ for tgs)
const DEFAULT_FFMPEG_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_CHARS = 8_000;
const STICKER_EXTENSIONS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif']);
const WEBM_EXTENSION = '.webm';
const WEBP_EXTENSION = '.webp';
const MAX_STICKER_BYTES = 1_000_000; // WhatsApp sticker limit ~1MB
const STICKER_CANVAS = 512; // WhatsApp sticker canvas (px)

// libwebp_anim conversion defaults. Benchmarked on a 2s/30fps test video:
//   compression_level 6 + fps 30 → ~11.2s  (slow — multi-frame lossy encode)
//   compression_level 4 + fps 20 → ~0.5s   (21× faster, same visual quality,
//                                           fps 20 = TStickers' own default)
// These are the bottleneck: frame count × resolution × compression effort.
// Input file size is NOT a significant factor.
const DEFAULT_WEBP_QUALITY = 90;
const DEFAULT_WEBP_COMPRESSION_LEVEL = 4;
const DEFAULT_WEBP_FPS = 20;

// Parallel ffmpeg conversion. Each ffmpeg run is single-threaded & CPU-bound,
// so running several at once (worker pool) cuts wall-clock time almost linearly
// on multi-core machines. Default 4 concurrent conversions.
const DEFAULT_CONCURRENCY = 4;

export interface TelegramStickerOptions {
  /** Full pack URL, e.g. https://t.me/addstickers/DonutTheDog */
  packUrl: string;
  /** Telegram bot token (overrides TSTICKERS_TOKEN / TELEGRAM_BOT_TOKEN env) */
  token?: string;
  /** Custom pack name shown in the WhatsApp sticker pack */
  packName?: string;
  authorName?: string;
}

export interface TelegramStickerResult {
  stickerBuffers: Buffer[];
  packName: string;
  sourceLabel: string;
  downloadedFiles: number;
  /** Number of animated .webm files converted to animated .webp via ffmpeg */
  webmConverted: number;
  /** True when the pack produced no WebP and the webm→webp fallback was used */
  usedWebmFallback: boolean;
  /** Number of stickers skipped for exceeding WhatsApp's ~1MB limit */
  skippedOversize: number;
}

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function getBinary(): string {
  return process.env.TSTICKERS_BIN?.trim() || 'tstickers';
}

function getToken(): string {
  const token = process.env.TSTICKERS_TOKEN?.trim() || process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error(
      'Telegram bot token not found. Set TSTICKERS_TOKEN or TELEGRAM_BOT_TOKEN in .env (create via @BotFather).',
    );
  }
  return token;
}

function getTimeoutMs(): number {
  const configured = Number(process.env.TSTICKERS_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function getFfmpegBin(): string {
  return process.env.FFMPEG_BIN?.trim() || 'ffmpeg';
}

function getFfmpegTimeoutMs(): number {
  const configured = Number(process.env.TSTICKERS_FFMPEG_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_FFMPEG_TIMEOUT_MS;
}

function getWebpQuality(): number {
  const configured = Number(process.env.TSTICKERS_WEBP_QUALITY);
  return Number.isFinite(configured) && configured >= 0 && configured <= 100
    ? configured
    : DEFAULT_WEBP_QUALITY;
}

function getWebpCompressionLevel(): number {
  const configured = Number(process.env.TSTICKERS_WEBP_COMPRESSION);
  return Number.isFinite(configured) && configured >= 0 && configured <= 6
    ? configured
    : DEFAULT_WEBP_COMPRESSION_LEVEL;
}

function getWebpFps(): number {
  const configured = Number(process.env.TSTICKERS_WEBP_FPS);
  return Number.isFinite(configured) && configured > 0 && configured <= 60
    ? configured
    : DEFAULT_WEBP_FPS;
}

function getConcurrency(): number {
  const configured = Number(process.env.TSTICKERS_CONCURRENCY);
  return Number.isFinite(configured) && configured >= 1 && configured <= 8
    ? configured
    : DEFAULT_CONCURRENCY;
}

function appendLimited(current: string, chunk: Buffer): string {
  const next = current + chunk.toString();
  return next.length > MAX_OUTPUT_CHARS ? next.slice(-MAX_OUTPUT_CHARS) : next;
}

/** Numeric-aware, case-insensitive path ordering (sticker_2 before sticker_10). */
function comparePaths(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** Extract the pack slug from a t.me/addstickers URL or accept a bare pack name. */
export function resolvePackSlug(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/addstickers\/([\w-]+)/i);
  if (match) return match[1];
  // Bare pack name — TStickers accepts a plain slug too (e.g. "DonutTheDog")
  return trimmed.replace(/^https?:\/\//, '').split('/')[0] || trimmed;
}

// ---------------------------------------------------------------------------
// Subprocess helpers
// ---------------------------------------------------------------------------

interface RunProcessOptions {
  cwd?: string;
  timeoutMs: number;
  /** Friendly message shown when the binary is missing (ENOENT). */
  notFoundMessage?: string;
}

/**
 * Spawn a binary and resolve when it exits successfully. Captures truncated
 * stdout/stderr for diagnostics. A "settled" guard prevents double
 * resolve/reject when both 'error' and 'close' fire.
 */
async function runProcess(command: string, args: string[], options: RunProcessOptions): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let stderr = '';
    let stdout = '';
    let timedOut = false;
    let settled = false;

    const child = spawn(command, args, { cwd: options.cwd, windowsHide: true });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, options.timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = appendLimited(stdout, chunk);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = appendLimited(stderr, chunk);
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error.code === 'ENOENT') {
        reject(new Error(options.notFoundMessage || `Command "${command}" not found.`));
        return;
      }
      reject(error);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Command "${command}" timed out after ${options.timeoutMs}ms.`));
        return;
      }
      if (code === 0) {
        resolve();
        return;
      }
      const detail = (stderr || stdout).trim();
      reject(new Error(detail || `Perintah "${command}" keluar dengan kode ${code}.`));
    });
  });
}

async function runTStickers(packInput: string, token: string, workDir: string): Promise<void> {
  // The CLI reads the token from `env`/`env.txt` in its CWD when -t is absent.
  await writeFile(join(workDir, 'env'), token, 'utf-8');
  await runProcess(getBinary(), ['-p', packInput], {
    cwd: workDir,
    timeoutMs: getTimeoutMs(),
    notFoundMessage:
      'tstickers not found. Install with "python -m pip install tstickers" or set TSTICKERS_BIN.',
  });
}

/**
 * Convert an animated .webm file into an animated .webp sticker.
 * WhatsApp animated stickers are WebP-based, so webm output from TStickers
 * must be converted with ffmpeg to be usable in a WhatsApp sticker pack.
 *
 * Key details:
 *   - `libwebp_anim` (NOT `libwebp`) is the encoder that produces ANIMATED
 *     webp. `libwebp` is static-only and fails on multi-frame input.
 *   - `-loop 0` is an OUTPUT option (placed after `-i`) → infinite loop.
 *   - `fps=` forces a constant frame rate (libwebp_anim requires it).
 */
async function convertWebmToAnimatedWebp(inputPath: string, outputPath: string): Promise<void> {
  // Scale/pad to the WhatsApp sticker canvas preserving aspect ratio with
  // transparent padding (0x00000000 = RGBA transparent black). fps is the
  // TStickers default (20) unless overridden via env — matches source quality
  // while cutting encode time nearly in half vs 30.
  const fps = getWebpFps();
  const args = [
    '-y',
    '-i',
    inputPath,
    '-vf',
    `scale=${STICKER_CANVAS}:${STICKER_CANVAS}:force_original_aspect_ratio=decrease,pad=${STICKER_CANVAS}:${STICKER_CANVAS}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=${fps}`,
    '-an',
    '-c:v',
    'libwebp_anim',
    '-loop',
    '0',
    '-lossless',
    '0',
    '-compression_level',
    String(getWebpCompressionLevel()),
    '-quality',
    String(getWebpQuality()),
    outputPath,
  ];
  await runProcess(getFfmpegBin(), args, {
    timeoutMs: getFfmpegTimeoutMs(),
    notFoundMessage:
      'ffmpeg not found. Install ffmpeg and ensure it is in PATH, or set FFMPEG_BIN for webm → animated webp conversion.',
  });
}

// ---------------------------------------------------------------------------
// Parallel conversion helpers
// ---------------------------------------------------------------------------

/**
 * Process items with a bounded number of concurrent workers. Each item's
 * task is an async function; results are collected in input order. A failed
 * task is reported via `onError` and the item is skipped — it never aborts
 * the whole batch.
 */
async function runBatchWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
  onError?: (item: T, error: unknown) => void,
): Promise<void> {
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      const item = items[index];
      try {
        await task(item);
      } catch (error) {
        onError?.(item, error);
      }
    }
  };

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

async function listFilesRecursive(directory: string): Promise<string[]> {
  const files: string[] = [];
  let entries: Dirent[] | undefined;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function collectStickerBuffers(files: string[]): Promise<{ buffers: Buffer[]; skippedOversize: number }> {
  const buffers: Buffer[] = [];
  let skippedOversize = 0;
  for (const filePath of files) {
    try {
      const buffer = await readFile(filePath);
      if (!buffer || buffer.length === 0) continue;
      if (buffer.length > MAX_STICKER_BYTES) {
        skippedOversize += 1;
        continue;
      }
      buffers.push(buffer);
    } catch {
      // skip unreadable files
    }
  }
  return { buffers, skippedOversize };
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

/**
 * Download a Telegram sticker pack via the tstickers CLI and return the
 * converted WebP sticker buffers ready for a WhatsApp sticker pack.
 *
 * Priority:
 *   1. WebP output (WhatsApp-ready, static & animated) — primary.
 *   2. If no WebP exists, convert .webm animated videos → animated WebP via ffmpeg.
 *   3. Last resort: any sticker-ish image (.png/.jpg/.gif).
 */
export async function downloadTelegramStickerPack(
  options: TelegramStickerOptions,
): Promise<TelegramStickerResult> {
  const packUrl = options.packUrl.trim();
  if (!packUrl) {
    throw new Error('Telegram pack URL not provided.');
  }

  const token = options.token?.trim() || getToken();
  const sourceLabel = packUrl;
  const packSlug = resolvePackSlug(packUrl);

  const workDir = await mkdtemp(join(tmpdir(), 'tstickers-'));

  try {
    await runTStickers(packUrl, token, workDir);

    const allFiles = await listFilesRecursive(workDir);

    log.debug(`[TelegramSticker] "${sourceLabel}": ${allFiles.length} files generated by tstickers.`);

    // ── Priority 1: WebP output (WhatsApp-ready) ──────────────────────────
    let stickerFiles = allFiles
      .filter((filePath) => extname(filePath).toLowerCase() === WEBP_EXTENSION)
      .sort(comparePaths);

    // ── Priority 2: no WebP → convert .webm animated videos to animated WebP ─
    let webmConverted = 0;
    if (stickerFiles.length === 0) {
      const webmFiles = allFiles
        .filter((filePath) => extname(filePath).toLowerCase() === WEBM_EXTENSION)
        .sort(comparePaths);

      if (webmFiles.length > 0) {
        const convertedDir = join(workDir, 'webp-converted');
        await mkdir(convertedDir, { recursive: true }); // ffmpeg does not create parent dirs

        // Precompute all output paths so they can be collected in input order.
        const jobs = webmFiles.map((webmFile) => ({
          webmFile,
          outPath: join(convertedDir, `${basename(webmFile, WEBM_EXTENSION)}${WEBP_EXTENSION}`),
        }));

        const convertedPaths: string[] = [];
        await runBatchWithConcurrency(
          jobs,
          getConcurrency(),
          async (job) => {
            await convertWebmToAnimatedWebp(job.webmFile, job.outPath);
            convertedPaths.push(job.outPath);
          },
          (job, error) => {
            // Keep going with the rest, but log the failure so it can be diagnosed.
            log.warn(`⚠️ Gagal konversi webm → webp: ${basename(job.webmFile)}`, {
              error: error instanceof Error ? error.message : String(error),
            });
          },
        );

        webmConverted = convertedPaths.length;
        stickerFiles = convertedPaths.sort(comparePaths);
      }
    }

    // ── Priority 3: any sticker-ish image (static packs without webp output) ─
    if (stickerFiles.length === 0) {
      stickerFiles = allFiles
        .filter((filePath) => STICKER_EXTENSIONS.has(extname(filePath).toLowerCase()))
        .sort(comparePaths);
    }

    if (stickerFiles.length === 0) {
      throw new Error(
        `tstickers ran successfully for "${sourceLabel}", but no sticker files (.webp/.webm) were found in the output.`,
      );
    }

    const { buffers: stickerBuffers, skippedOversize } = await collectStickerBuffers(stickerFiles);

    if (stickerBuffers.length === 0) {
      throw new Error(
        'All sticker files from the Telegram pack failed to read or exceeded the 1MB size limit.',
      );
    }

    log.debug(
      `[TelegramSticker] "${sourceLabel}": ${stickerBuffers.length} sticker siap, ${webmConverted} webm→webp, ${skippedOversize} oversize dilewati.`,
    );

    return {
      stickerBuffers,
      packName: options.packName || packSlug,
      sourceLabel,
      downloadedFiles: allFiles.length,
      webmConverted,
      usedWebmFallback: webmConverted > 0,
      skippedOversize,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export default downloadTelegramStickerPack;
