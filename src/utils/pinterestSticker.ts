import { spawn } from 'child_process';
import { randomInt } from 'crypto';
import { mkdtemp, readdir, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, extname, join } from 'path';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';

export type PinterestStickerType = 'default' | 'cropped' | 'full';

export interface PinterestStickerOptions {
  url?: string;
  query?: string;
  packName?: string;
  authorName?: string;
  stickerType?: PinterestStickerType;
  index?: number;
}

export interface PinterestStickerResult {
  stickerBuffer: Buffer;
  sourceFileName: string;
  downloadedFiles: number;
}

export interface PinterestStickerBatchOptions {
  url?: string;
  query?: string;
  packName?: string;
  authorName?: string;
  stickerType?: PinterestStickerType;
  count?: number;
  startIndex?: number;
}

export interface PinterestStickerBatchResult {
  stickers: PinterestStickerResult[];
  totalDownloaded: number;
  successCount: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_CHARS = 4_000;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const PINTEREST_URL_PATTERN = /^https?:\/\/([a-z0-9-]+\.)?(pinterest\.[a-z.]+|pin\.it)\//i;
const MAX_BATCH_COUNT = 50;

function getBinary(): string {
  return process.env.PINTEREST_DL_BIN?.trim() || 'gallery-dl';
}

function getTimeoutMs(): number {
  const configured = Number(process.env.PINTEREST_DL_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function appendLimited(current: string, chunk: Buffer): string {
  const next = current + chunk.toString();
  return next.length > MAX_OUTPUT_CHARS ? next.slice(-MAX_OUTPUT_CHARS) : next;
}

function normalizeIndex(index?: number): number {
  if (!Number.isFinite(index) || !index || index < 1) return 1;
  return Math.min(Math.floor(index), 50);
}

function normalizeCount(count?: number): number {
  if (!Number.isFinite(count) || !count || count < 1) return 1;
  return Math.min(Math.floor(count), MAX_BATCH_COUNT);
}

/**
 * Fisher-Yates shuffle to randomize array order in-place.
 */
function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function resolveStickerType(type?: PinterestStickerType) {
  switch (type) {
    case 'default':
      return StickerTypes.DEFAULT;
    case 'cropped':
      return StickerTypes.CROPPED;
    case 'full':
    default:
      return StickerTypes.FULL;
  }
}

function buildSearchUrl(query: string): string {
  return `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
}

function isPinterestUrl(url: string): boolean {
  return PINTEREST_URL_PATTERN.test(url.trim());
}

function resolveInput(options: PinterestStickerOptions | PinterestStickerBatchOptions): { targetUrl: string; sourceLabel: string } {
  const rawUrl = options.url?.trim();
  const rawQuery = options.query?.trim();

  if (rawUrl && isPinterestUrl(rawUrl)) {
    return { targetUrl: rawUrl, sourceLabel: rawUrl };
  }

  const query = rawQuery || rawUrl;
  if (!query) {
    throw new Error('Pinterest URL or search keyword not provided.');
  }

  return { targetUrl: buildSearchUrl(query), sourceLabel: query };
}

async function listFilesRecursive(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(fullPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function runGalleryDl(url: string, outputDir: string, index: number): Promise<void> {
  const args = [
    '--config-ignore',
    '--no-input',
    '--no-part',
    '--no-mtime',
    '--range',
    String(index),
    '-D',
    outputDir,
  ];

  const cookiesPath = process.env.PINTEREST_DL_COOKIES?.trim();
  if (cookiesPath) {
    args.push('--cookies', cookiesPath);
  }

  args.push(url);

  await new Promise<void>((resolve, reject) => {
    let stderr = '';
    let stdout = '';
    let timedOut = false;

    const child = spawn(getBinary(), args, { windowsHide: true });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, getTimeoutMs());

    child.stdout.on('data', (chunk: Buffer) => {
      stdout = appendLimited(stdout, chunk);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr = appendLimited(stderr, chunk);
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (error.code === 'ENOENT') {
        reject(new Error('gallery-dl not found. Install with "python -m pip install -U gallery-dl" or set PINTEREST_DL_BIN.'));
        return;
      }
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error('gallery-dl timeout while fetching media from Pinterest.'));
        return;
      }
      if (code === 0) {
        resolve();
        return;
      }

      const detail = (stderr || stdout).trim();
      reject(new Error(detail || `gallery-dl keluar dengan kode ${code}.`));
    });
  });
}

async function runGalleryDlBatch(url: string, outputDir: string, startIndex: number, count: number): Promise<void> {
  // gallery-dl --range supports formats like "1-5" for a range
  const rangeStr = `${startIndex}-${startIndex + count - 1}`;
  const args = [
    '--config-ignore',
    '--no-input',
    '--no-part',
    '--no-mtime',
    '--range',
    rangeStr,
    '-D',
    outputDir,
  ];

  const cookiesPath = process.env.PINTEREST_DL_COOKIES?.trim();
  if (cookiesPath) {
    args.push('--cookies', cookiesPath);
  }

  args.push(url);

  await new Promise<void>((resolve, reject) => {
    let stderr = '';
    let stdout = '';
    let timedOut = false;

    const child = spawn(getBinary(), args, { windowsHide: true });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, getTimeoutMs());

    child.stdout.on('data', (chunk: Buffer) => {
      stdout = appendLimited(stdout, chunk);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr = appendLimited(stderr, chunk);
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (error.code === 'ENOENT') {
        reject(new Error('gallery-dl not found. Install with "python -m pip install -U gallery-dl" or set PINTEREST_DL_BIN.'));
        return;
      }
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error('gallery-dl timeout while fetching media from Pinterest.'));
        return;
      }
      // gallery-dl returns non-zero if some items in range don't exist,
      // but it may have downloaded some files. Proceed anyway.
      resolve();
    });
  });
}

export async function createPinterestSticker(options: PinterestStickerOptions): Promise<PinterestStickerResult> {
  const { targetUrl, sourceLabel } = resolveInput(options);

  const workDir = await mkdtemp(join(tmpdir(), 'pinterest-sticker-'));

  try {
    await runGalleryDl(targetUrl, workDir, normalizeIndex(options.index));

    const downloadedFiles = await listFilesRecursive(workDir);
    const imageFiles = downloadedFiles
      .filter((filePath) => IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase()))
      .sort((a, b) => a.localeCompare(b));

    if (imageFiles.length === 0) {
      throw new Error(`gallery-dl ran successfully for Pinterest "${sourceLabel}", but no image files were found to create a sticker.`);
    }

    const sourceFile = imageFiles[0];
    const imageBuffer = await readFile(sourceFile);
    const sticker = new Sticker(imageBuffer, {
      pack: options.packName || 'Staz-AI-Bot',
      author: options.authorName || '',
      type: resolveStickerType(options.stickerType),
      quality: 100,
    });

    return {
      stickerBuffer: await sticker.toBuffer(),
      sourceFileName: basename(sourceFile),
      downloadedFiles: downloadedFiles.length,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Create multiple stickers from Pinterest in a single call.
 * Uses gallery-dl with a range to download multiple images at once.
 *
 * @param options - Batch options including count and optional startIndex
 * @returns Batch result with array of sticker buffers
 */
export async function createPinterestStickers(options: PinterestStickerBatchOptions): Promise<PinterestStickerBatchResult> {
  const { targetUrl } = resolveInput(options);
  const count = normalizeCount(options.count);

  // If user didn't specify a startIndex, randomize it so repeated calls
  // don't always download the same range (avoiding duplicate stickers).
  const startIndex = options.startIndex
    ? normalizeIndex(options.startIndex)
    : randomInt(1, 51 - count + 1);

  const workDir = await mkdtemp(join(tmpdir(), 'pinterest-stickers-batch-'));

  try {
    // Download a range of images using gallery-dl
    await runGalleryDlBatch(targetUrl, workDir, startIndex, count);

    const downloadedFiles = await listFilesRecursive(workDir);
    const imageFiles = downloadedFiles
      .filter((filePath) => IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase()));
      // No sort — keep gallery-dl's natural order which may vary

    if (imageFiles.length === 0) {
      throw new Error('No image files found from Pinterest.');
    }

    // Shuffle downloaded files and take up to `count`
    const selectedFiles = shuffleArray(imageFiles).slice(0, count);
    const stickers: PinterestStickerResult[] = [];

    for (const filePath of selectedFiles) {
      try {
        const imageBuffer = await readFile(filePath);
        const sticker = new Sticker(imageBuffer, {
          pack: options.packName || 'Staz AI Bot',
          author: options.authorName || 'Di buat oleh : Staz AI Bot\n\nJangan lupa follow IG owner @wahyuhp57',
          type: resolveStickerType(options.stickerType),
          quality: 100,
        });

        stickers.push({
          stickerBuffer: await sticker.toBuffer(),
          sourceFileName: basename(filePath),
          downloadedFiles: downloadedFiles.length,
        });
      } catch (stickerError) {
        console.error(`[PinterestSticker] Failed to create sticker from ${filePath}:`, stickerError);
        // Skip failed stickers, continue with the rest
      }
    }

    if (stickers.length === 0) {
      throw new Error('Failed to create sticker from downloaded images.');
    }

    return {
      stickers,
      totalDownloaded: downloadedFiles.length,
      successCount: stickers.length,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
