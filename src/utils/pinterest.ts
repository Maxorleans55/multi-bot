import { spawn } from 'child_process';
import { randomInt } from 'crypto';

const DEFAULT_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_CHARS = 10_000;
const MAX_RESULTS = 50;

/**
 * Fisher-Yates shuffle to randomize array order in-place.
 * Ensures each call returns results in a different sequence.
 */
function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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

function buildSearchUrl(query: string): string {
  return `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
}

/**
 * Run gallery-dl in JSON dump mode to extract downloadable image URLs
 * from a Pinterest URL without actually downloading the files.
 *
 * @param url - Pinterest URL (search page, pin, board, etc.)
 * @returns Array of direct image URLs
 */
function runGalleryDlGetUrls(url: string): Promise<string[]> {
  const args: string[] = [
    '--config-ignore',
    '--no-input',
    '-j', // dump JSON metadata for each item
  ];

  const cookiesPath = process.env.PINTEREST_DL_COOKIES?.trim();
  if (cookiesPath) {
    args.push('--cookies', cookiesPath);
  }

  args.push(url);

  return new Promise<string[]>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
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
        reject(
          new Error(
            'gallery-dl tidak ditemukan. Install dulu dengan "python -m pip install -U gallery-dl" atau set PINTEREST_DL_BIN.',
          ),
        );
        return;
      }
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error('gallery-dl timeout saat mengambil data dari Pinterest.'));
        return;
      }
      if (code !== 0) {
        const detail = (stderr || stdout).trim();
        reject(new Error(detail || `gallery-dl keluar dengan kode ${code}.`));
        return;
      }

      // Parse JSON lines output — each line is a JSON object with metadata
      const urls: string[] = [];
      const lines = stdout.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed);
          // The 'url' field contains the direct downloadable image URL
          if (typeof parsed.url === 'string' && parsed.url.startsWith('http')) {
            urls.push(parsed.url);
          }
        } catch {
          // Skip lines that aren't valid JSON
        }

        // Stop once we have enough results
        if (urls.length >= MAX_RESULTS) break;
      }

      if (urls.length === 0) {
        // If no URLs found via JSON, try --get-urls fallback
        resolve(runGalleryDlGetUrlsFallback(url));
        return;
      }

      resolve(urls);
    });
  });
}

/**
 * Fallback: use gallery-dl --get-urls mode to extract download URLs.
 */
function runGalleryDlGetUrlsFallback(url: string): Promise<string[]> {
  const args: string[] = [
    '--config-ignore',
    '--no-input',
    '--get-urls',
  ];

  const cookiesPath = process.env.PINTEREST_DL_COOKIES?.trim();
  if (cookiesPath) {
    args.push('--cookies', cookiesPath);
  }

  args.push(url);

  return new Promise<string[]>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
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
        reject(
          new Error(
            'gallery-dl tidak ditemukan. Install dulu dengan "python -m pip install -U gallery-dl" atau set PINTEREST_DL_BIN.',
          ),
        );
        return;
      }
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error('gallery-dl timeout saat mengambil data dari Pinterest.'));
        return;
      }
      if (code !== 0) {
        const detail = (stderr || stdout).trim();
        reject(new Error(detail || `gallery-dl keluar dengan kode ${code}.`));
        return;
      }

      // Each line is a URL
      const urls = stdout
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('http'))
        .slice(0, MAX_RESULTS);

      if (urls.length === 0) {
        reject(new Error('Tidak ada URL gambar yang ditemukan dari Pinterest.'));
        return;
      }

      resolve(urls);
    });
  });
}

/**
 * Search Pinterest for images based on a query string.
 * Uses gallery-dl to extract direct image URLs from Pinterest search results.
 *
 * @param query - The search term to find images on Pinterest
 * @returns An array of image URLs
 */
export default async function pinterest(query: string): Promise<string[]> {
  const searchUrl = buildSearchUrl(query);
  const results = await runGalleryDlGetUrls(searchUrl);
  // Shuffle so repeated queries return images in different order
  return shuffleArray(results);
}
