import { spawn } from 'child_process';
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

const DEFAULT_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_CHARS = 4_000;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const PINTEREST_URL_PATTERN = /^https?:\/\/([a-z0-9-]+\.)?(pinterest\.[a-z.]+|pin\.it)\//i;

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

function resolveInput(options: PinterestStickerOptions): { targetUrl: string; sourceLabel: string } {
  const rawUrl = options.url?.trim();
  const rawQuery = options.query?.trim();

  if (rawUrl && isPinterestUrl(rawUrl)) {
    return { targetUrl: rawUrl, sourceLabel: rawUrl };
  }

  const query = rawQuery || rawUrl;
  if (!query) {
    throw new Error('URL Pinterest atau kata kunci pencarian tidak diberikan.');
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
        reject(new Error('gallery-dl tidak ditemukan. Install dulu dengan "python -m pip install -U gallery-dl" atau set PINTEREST_DL_BIN.'));
        return;
      }
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error('gallery-dl timeout saat mengambil media dari Pinterest.'));
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
      throw new Error(`gallery-dl berhasil jalan untuk Pinterest "${sourceLabel}", tapi tidak ada file gambar yang bisa dijadikan sticker.`);
    }

    const sourceFile = imageFiles[0];
    const imageBuffer = await readFile(sourceFile);
    const sticker = new Sticker(imageBuffer, {
      pack: options.packName || 'Yu-Bot-AI',
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
