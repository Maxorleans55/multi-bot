import { spawn } from 'child_process';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

// ─── Types ─────────────────────────────────────────────────────────────────

/** Response shape matching nexo-aio-downloader's InstagramResponse for drop-in compatibility */
export interface InstagramMediaData {
  url: string[];
  /** Local file path when a DASH video was downloaded & merged with ffmpeg */
  mergedFilePath?: string;
  caption: string | null;
  username: string | null;
  like: number | null;
  comment: number | null;
  isVideo: boolean;
}

export interface InstagramResult {
  status: boolean;
  data?: InstagramMediaData;
  message?: string;
}

// ─── Konfigurasi ────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_CHARS = 100_000;
const TEMP_DIR = join(process.cwd(), 'temp');

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

function ensureTempDir(): void {
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }
}

/**
 * Push cookie-related flags into `args` based on env vars.
 *
 * Supports two modes:
 * 1. INSTAGRAM_DL_COOKIES / YTDLP_COOKIES → path ke file cookies.txt (Netscape format)
 *    → `--cookies /path/to/cookies.txt`
 * 2. INSTAGRAM_DL_COOKIES_BROWSER → nama browser (chrome, firefox, edge, dll)
 *    → `--cookies-from-browser chrome`
 *
 * Prioritas: browser mode jika diset, lalu file mode.
 */
function pushCookieArgs(args: string[]): void {
  const browser = process.env.INSTAGRAM_DL_COOKIES_BROWSER?.trim();
  if (browser) {
    console.log(`[Instagram Utils] Using cookies-from-browser: ${browser}`);
    args.push('--cookies-from-browser', browser);
    return;
  }

  const cookiesPath =
    process.env.INSTAGRAM_DL_COOKIES?.trim() ||
    process.env.YTDLP_COOKIES?.trim();
  if (cookiesPath) {
    console.log(`[Instagram Utils] Using cookies file: ${cookiesPath} (exists: ${existsSync(cookiesPath)})`);
    args.push('--cookies', cookiesPath);
  } else {
    console.log('[Instagram Utils] No cookies configured — Instagram may block unauthenticated requests.');
  }
}

// ─── Internal ───────────────────────────────────────────────────────────────

interface YtDlpFormat {
  url?: string;
  ext?: string;
  vcodec?: string;
  acodec?: string;
  format_id?: string;
  format_note?: string;
  width?: number;
  height?: number;
  tbr?: number;
  abr?: number;
  vbr?: number;
  resolution?: string;
}

interface YtDlpEntry {
  url?: string;
  ext?: string;
  title?: string;
  description?: string;
  uploader?: string;
  like_count?: number;
  comment_count?: number;
  duration?: number;
  webpage_url?: string;
  _type?: string;
  id?: string;
  formats?: YtDlpFormat[];
  requested_formats?: YtDlpFormat[];
  /** Carousel/image post children (may contain nested entries) */
  entries?: YtDlpEntry[];
  /** For carousel posts, yt-dlp sometimes uses `playlist` key (may be a string title, not array) */
  playlist?: YtDlpEntry[];
  /** Image posts: actual CDN image URLs live in thumbnails[] */
  thumbnails?: YtDlpFormat[];
}

function isVideo(entry: YtDlpEntry): boolean {
  if (entry.duration !== undefined && entry.duration > 0) return true;
  if (entry.ext) {
    const ext = entry.ext.toLowerCase();
    return ext === 'mp4' || ext === 'webm' || ext === 'mkv' || ext === 'mov';
  }
  return false;
}

/**
 * Check whether this entry (or any child in a carousel) is a DASH-streamed
 * video — has separate video-only and audio-only streams that need ffmpeg merging.
 */
function isDashVideo(entry: YtDlpEntry): boolean {
  const all = flattenEntries(entry);
  return all.some((e) => {
    const formats = Array.isArray(e.formats) ? e.formats : [];
    const hasVideoOnly = formats.some(
      (f) => f.vcodec && f.vcodec !== 'none' && (!f.acodec || f.acodec === 'none'),
    );
    const hasAudioOnly = formats.some(
      (f) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'),
    );
    return hasVideoOnly && hasAudioOnly;
  });
}

function extractCaption(entry: YtDlpEntry): string | null {
  if (entry.description && entry.description.trim().length > 0) {
    return entry.description.trim();
  }
  if (entry.title && entry.title.trim().length > 0) {
    return entry.title.trim();
  }
  return null;
}

/**
 * Flatten a playlist/carousel entry into its leaf (slide) entries.
 */
function flattenEntries(entry: YtDlpEntry): YtDlpEntry[] {
  if (Array.isArray(entry.entries) && entry.entries.length > 0) {
    return entry.entries;
  }
  if (Array.isArray(entry.playlist) && entry.playlist.length > 0) {
    return entry.playlist;
  }
  return [entry];
}

/**
 * Extract all direct media URLs from a single entry.
 * Checks: top-level url → formats[]/requested_formats[] → thumbnails[] (image posts).
 */
function extractUrlsFromEntry(entry: YtDlpEntry): string[] {
  const urls: string[] = [];

  // 1. Top-level direct URL
  if (entry.url && typeof entry.url === 'string' && entry.url.startsWith('http')) {
    urls.push(entry.url);
  }

  // 2. Nested formats (video/audio streams)
  const nested = Array.isArray(entry.formats)
    ? entry.formats
    : Array.isArray(entry.requested_formats)
      ? entry.requested_formats
      : [];
  for (const fmt of nested) {
    if (fmt.url && typeof fmt.url === 'string' && fmt.url.startsWith('http')) {
      urls.push(fmt.url);
    }
  }

  // 3. Thumbnails (image posts put CDN URLs here, largest resolution = actual image)
  //    Only include if we haven't found anything else — dedupe by picking the
  //    single highest-resolution thumbnail per entry.
  if (urls.length === 0 && Array.isArray(entry.thumbnails) && entry.thumbnails.length > 0) {
    // Pick the thumbnail with the largest resolution
    const sorted = [...entry.thumbnails].sort((a, b) => {
      const areaA = (a.width ?? 0) * (a.height ?? 0);
      const areaB = (b.width ?? 0) * (b.height ?? 0);
      return areaB - areaA;
    });
    const best = sorted[0];
    if (best.url && typeof best.url === 'string' && best.url.startsWith('http')) {
      urls.push(best.url);
    }
  }

  return urls;
}

/**
 * Run yt-dlp --dump-json via spawn and return parsed entries.
 */
function getInstagramJson(url: string): Promise<YtDlpEntry[]> {
  const args: string[] = [
    '--no-warnings',
    '--no-check-certificates',
    '--ignore-no-formats-error',
    '--dump-json',
  ];

  pushCookieArgs(args);
  args.push(url);

  return new Promise<YtDlpEntry[]>((resolve, reject) => {
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
            'yt-dlp tidak ditemukan. Install dulu dengan "pip install yt-dlp" atau set YTDLP_BIN.',
          ),
        );
        return;
      }
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
        const parsed = lines.map((l) => JSON.parse(l) as YtDlpEntry);
        resolve(parsed);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        reject(new Error(`Gagal parse output yt-dlp: ${message}`));
      }
    });
  });
}

/**
 * Download and merge a DASH video using yt-dlp's built-in ffmpeg merge.
 * Returns the local file path of the merged mp4.
 */
function downloadMergedVideo(url: string, videoId: string): Promise<string> {
  ensureTempDir();

  const outputTemplate = join(TEMP_DIR, `ig_${videoId}.%(ext)s`);
  const expectedPath = join(TEMP_DIR, `ig_${videoId}.mp4`);

  const args: string[] = [
    '--no-warnings',
    '--no-check-certificates',
    '-f',
    'bestvideo+bestaudio/best',
    '--merge-output-format',
    'mp4',
    '-o',
    outputTemplate,
  ];

  pushCookieArgs(args);
  args.push(url);

  return new Promise<string>((resolve, reject) => {
    let stderr = '';
    let timedOut = false;

    const child = spawn(getBinary(), args, { windowsHide: true });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, getTimeoutMs());

    child.stderr.on('data', (chunk: Buffer) => {
      stderr = appendLimited(stderr, chunk);
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(new Error(`yt-dlp download spawn gagal: ${error.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`yt-dlp download timeout setelah ${getTimeoutMs() / 1000}s`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`yt-dlp download exit code ${code}: ${stderr.slice(-500)}`));
        return;
      }
      if (existsSync(expectedPath)) {
        resolve(expectedPath);
      } else {
        reject(new Error('File hasil merge tidak ditemukan setelah download.'));
      }
    });
  });
}

function buildResult(entries: YtDlpEntry[]): {
  result: InstagramResult;
  needsMerge: boolean;
  mergeVideoId: string | null;
} {
  if (entries.length === 0) {
    return {
      result: { status: false, message: 'Tidak ada media ditemukan di URL Instagram tersebut.' },
      needsMerge: false,
      mergeVideoId: null,
    };
  }

  const first = entries[0];

  // Flatten playlist entries into individual slides
  const slides = entries.flatMap((e) => flattenEntries(e));
  const isVideoPost = slides.some((e) => isVideo(e)) || isDashVideo(first);
  const needsMerge = isDashVideo(first);

  // Collect all URLs from every slide entry
  const urls = slides.flatMap((e) => extractUrlsFromEntry(e));

  if (urls.length === 0) {
    console.error(
      '[Instagram Utils] No direct media URLs extracted. Raw entry keys:',
      first ? Object.keys(first) : 'null',
      `_type: ${first?._type || 'none'}`,
      `formats isArray:${Array.isArray((first as any)?.formats)} len:${(first as any)?.formats?.length ?? 'N/A'}`,
      `thumbnails isArray:${Array.isArray((first as any)?.thumbnails)} len:${(first as any)?.thumbnails?.length ?? 'N/A'}`,
      `slides count: ${slides.length}`,
      first ? JSON.stringify(first).slice(0, 500) : '',
    );
    return {
      result: {
        status: false,
        message: 'Gagal mengekstrak URL media dari Instagram. Post mungkin privat atau tidak ditemukan.',
      },
      needsMerge: false,
      mergeVideoId: null,
    };
  }

  return {
    result: {
      status: true,
      data: {
        url: urls,
        caption: extractCaption(first),
        username: first.uploader ?? null,
        like: typeof first.like_count === 'number' ? first.like_count : null,
        comment: typeof first.comment_count === 'number' ? first.comment_count : null,
        isVideo: isVideoPost,
      },
    },
    needsMerge,
    mergeVideoId: first.id || first.webpage_url?.split('/').pop()?.split('?')[0] || null,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Extract media info from an Instagram URL using yt-dlp --dump-json.
 *
 * For DASH-streamed video (Reels), this also downloads a merged video+audio
 * file via ffmpeg and returns the local path in `data.mergedFilePath`.
 *
 * @param url - Instagram post, Reel, or carousel URL
 * @returns InstagramResult with status, data, and optional message
 */
export default async function instagramDownload(url: string): Promise<InstagramResult> {
  try {
    const entries = await getInstagramJson(url);
    const { result, needsMerge, mergeVideoId } = buildResult(entries);

    if (needsMerge && mergeVideoId && result.data) {
      try {
        const mergedPath = await downloadMergedVideo(url, mergeVideoId);
        result.data.mergedFilePath = mergedPath;
      } catch (mergeErr: unknown) {
        const msg = mergeErr instanceof Error ? mergeErr.message : String(mergeErr);
        console.error('[Instagram Utils] Merge download failed, will fallback to raw URLs:', msg);
      }
    }

    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Instagram Utils] Download error:', message);
    return {
      status: false,
      message: `Gagal mendownload dari Instagram: ${message}`,
    };
  }
}

/**
 * Clean up a temporary merged video file after it has been sent.
 * Call this after the file has been successfully delivered to WhatsApp.
 */
export function cleanupMergedFile(filePath: string): void {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    // Best-effort cleanup, ignore errors
  }
}
