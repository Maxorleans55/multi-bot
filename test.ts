import { spawn } from 'child_process';

// ─── Konfigurasi ──────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_CHARS = 100_000;

function getBinary(): string {
  return process.env.YTDLP_BIN?.trim() || 'yt-dlp';
}

function getTimeoutMs(): number {
  const configured = Number(process.env.YTDLP_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function appendLimited(current: string, chunk: Buffer): string {
  const next = current + chunk.toString();
  return next.length > MAX_OUTPUT_CHARS ? next.slice(-MAX_OUTPUT_CHARS) : next;
}

// ─── Core ─────────────────────────────────────────────────────────────────

/**
 * Jalankan yt-dlp --dump-json via spawn dan kembalikan payload yang sudah di-parse.
 * Pola ini mengikuti konvensi `src/utils/pinterest.ts` (spawn + buffer + timeout).
 *
 * Flag --ignore-no-formats-error diperlukan agar yt-dlp tidak gagal pada
 * post Instagram carousel/gambar yang tidak memiliki format video.
 * Tanpa flag ini, slide tanpa video akan menyebabkan exit code 1.
 *
 * @param url       - URL Instagram (post, Reel, atau carousel)
 * @param allEntries - Jika true, kembalikan semua entry (carousel); default ambil entry pertama
 */
function getInstagramJson(
  url: string,
  allEntries: boolean = false
): Promise<Record<string, unknown> | Record<string, unknown>[]> {
  const args: string[] = [
    '--no-warnings',
    '--no-check-certificates',
    '--ignore-no-formats-error',
    '--dump-json',
  ];

  const cookiesPath =
    process.env.INSTAGRAM_DL_COOKIES?.trim() ||
    process.env.YTDLP_COOKIES?.trim();
  if (cookiesPath) {
    console.log('Using cookies from:', cookiesPath);
    args.push('--cookies', cookiesPath);
  }

  args.push(url);

  return new Promise((resolve, reject) => {
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
      reject(new Error(`yt-dlp spawn gagal: ${error.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`yt-dlp timeout setelah ${getTimeoutMs() / 1000}s`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`yt-dlp exit code ${code}: ${stderr.slice(-500)}`));
        return;
      }
      try {
        const lines = stdout.trim().split('\n').filter(Boolean);
        if (lines.length === 0) {
          reject(new Error('yt-dlp tidak menghasilkan output'));
          return;
        }
        const parsed = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
        resolve(allEntries ? parsed : parsed[0]);
      } catch (err: any) {
        reject(new Error(`Gagal parse output yt-dlp: ${err.message}`));
      }
    });
  });
}

// ─── Test ─────────────────────────────────────────────────────────────────

getInstagramJson(
  'https://www.instagram.com/p/DaM3CVmEVwh/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==',
  true
)
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error('Error:', error.message);
  });