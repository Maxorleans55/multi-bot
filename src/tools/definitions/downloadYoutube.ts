import type {
  AIToolDefinition,
  ToolExecuteFunction,
  ToolExecuteResult,
  ToolContext,
} from '../../types/tools.js';
import path from 'path';
import { promises as fs } from 'fs';
import { log } from '../../utils/logger.js';

interface YoutubeDlInfo {
  id?: string;
  title?: string;
  uploader?: string;
  duration?: number;
  webpage_url?: string;
}

const isYouTubeUrl = (input: string): boolean =>
  /^(?:https?:\/\/)?(?:(?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\//i.test(input);

const normalizeYouTubeUrl = (input: string): string =>
  /^https?:\/\//i.test(input) ? input : `https://${input}`;

const baseYoutubeDlFlags = {
  noWarnings: true,
  noCheckCertificates: true,
  preferFreeFormats: true,
};

const resolveYoutubeInput = async (
  youtubeDl: (input: string, flags?: Record<string, any>, options?: Record<string, any>) => Promise<unknown>,
  input: string,
  tempDir: string
): Promise<YoutubeDlInfo | null> => {
  const trimmedInput = input.trim();

  if (isYouTubeUrl(trimmedInput)) {
    return await youtubeDl(normalizeYouTubeUrl(trimmedInput), {
      ...baseYoutubeDlFlags,
      dumpJson: true,
    }, { cwd: tempDir }) as YoutubeDlInfo;
  }

  const searchResult = await youtubeDl(trimmedInput, {
    ...baseYoutubeDlFlags,
    printJson: true,
    simulate: true,
    skipDownload: true,
    defaultSearch: 'ytsearch1',
  }, { cwd: tempDir }) as YoutubeDlInfo;

  if (!searchResult?.webpage_url) {
    return searchResult?.id
      ? { ...searchResult, webpage_url: `https://www.youtube.com/watch?v=${searchResult.id}` }
      : null;
  }

  return searchResult;
};

/**
 * YouTube tool definition.
 * Downloads YouTube video/audio and sends directly to the WhatsApp user.
 * Supports sending as document for files up to 2GB.
 */
export const definition: AIToolDefinition = {
  type: 'function',
  function: {
    name: 'download_youtube',
    description: 'Download video or audio from YouTube. Accepts EITHER a YouTube URL OR a plain search query / song title / keywords. For songs, the tool will search YouTube automatically via yt-dlp — no need to call web_search first.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'A YouTube URL (e.g. https://youtube.com/watch?v=xxx) OR a plain song title / search keywords (e.g. "Sederhana Sheila On 7"). The tool auto-detects whether it is a URL and searches YouTube if not.',
        },
        format: {
          type: 'string',
          description: 'Download format. "video" for mp4, "audio" for mp3. Default: "video".',
          enum: ['video', 'audio'],
        },
        quality: {
          type: 'string',
          description: 'Video quality. "best", "720p", "360p". Default: "best".',
          enum: ['best', '720p', '360p'],
        },
        as_document: {
          type: 'boolean',
          description: 'Send as document instead of video/audio. Allows files up to 2GB (WhatsApp document limit). Default: false.',
        },
      },
      required: ['query'],
    },
  },
};

/**
 * Detect whether the user explicitly asked for the result to be sent as a
 * document/file (as opposed to native audio/video). This is a safety net for
 * models that ignore the `as_document` argument in favor of `format`.
 */
const WANTS_DOCUMENT_PATTERN = /(?:dokumen|document|file)/i;
const WANTS_AUDIO_PATTERN = /(?:lagu|musik|music|song|audio|mp3|suara)/i;

const hasDocumentIntent = (userMessage: string): boolean =>
  WANTS_DOCUMENT_PATTERN.test(userMessage);

const hasAudioIntent = (userMessage: string): boolean =>
  WANTS_AUDIO_PATTERN.test(userMessage);

// ─────────────────────────────────────────────────────────────
//  DUPLICATE DOWNLOAD GUARD
// ─────────────────────────────────────────────────────────────
// Some models re-issue download_youtube with slightly different
// phrasings of the same song title within one turn (or minutes apart).
// Without a guard, the same song gets downloaded and sent 2-3x.
// This keeps a short per-session memory of successful downloads and
// short-circuits near-identical queries.

interface RecentDownload {
  sessionKey: string;
  query: string;
  format: string;
  asDocument: boolean;
  result: ToolExecuteResult;
  at: number;
}

const recentDownloads = new Map<string, RecentDownload>();
const DEDUP_WINDOW_MS = 10 * 60 * 1000;
const MAX_RECENT_ENTRIES = 200;
const JACCARD_THRESHOLD = 0.6;
const MIN_WORDS_FOR_CONTAINED = 2;
const TEMP_FILE_CLEANUP_MS = 30 * 1000;

const QUERY_STOPWORDS = new Set([
  'official', 'audio', 'video', 'lyrics', 'lyric', 'lagu', 'song', 'mp3',
  'full', 'the', 'and', 'of', 'feat', 'ft', 'remix', 'cover', 'live',
  'karaoke', 'hd', 'download', 'youtube', 'music', 'musik', 'terbaru',
]);

/** Normalize a query into meaningful keywords (lowercase, no stopwords). */
function normalizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !QUERY_STOPWORDS.has(w));
}

/** Jaccard similarity between two keyword sets (0..1). */
function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const union = new Set([...setA, ...setB]);
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  return intersection / union.size;
}

/** Stable key for a session + normalized query + format + document flag. */
function getDedupKey(
  sessionKey: string,
  query: string,
  format: string,
  asDocument: boolean,
): string {
  return `${sessionKey}\u0000${normalizeQuery(query).join(' ')}\u0000${format}\u0000${asDocument}`;
}

/**
 * Find a recent successful download for the same session that is a
 * near-duplicate. Pass `format: null` to match any format (used to inherit
 * the format of a previous download when the model omitted it).
 */
function findRecentDownload(
  sessionKey: string,
  query: string,
  format: string | null,
  asDocument: boolean,
): RecentDownload | null {
  const words = normalizeQuery(query);
  const now = Date.now();

  for (const [key, rec] of recentDownloads) {
    if (now - rec.at > DEDUP_WINDOW_MS) {
      recentDownloads.delete(key);
      continue;
    }
    if (rec.sessionKey !== sessionKey || rec.asDocument !== asDocument) continue;
    if (format !== null && rec.format !== format) continue;

    const recWords = normalizeQuery(rec.query);
    const sameWords =
      words.length > 0 && words.join(' ') === recWords.join(' ');
    const highOverlap = jaccard(words, recWords) >= JACCARD_THRESHOLD;
    const contained =
      (words.length >= MIN_WORDS_FOR_CONTAINED && words.every((w) => recWords.includes(w))) ||
      (recWords.length >= MIN_WORDS_FOR_CONTAINED && recWords.every((w) => words.includes(w)));

    if (sameWords || highOverlap || contained) return rec;
  }

  return null;
}

/** Return the most recent successful download for a session (any format). */
function findLatestDownload(sessionKey: string): RecentDownload | null {
  let latest: RecentDownload | null = null;
  const now = Date.now();

  for (const [key, rec] of recentDownloads) {
    if (now - rec.at > DEDUP_WINDOW_MS) {
      recentDownloads.delete(key);
      continue;
    }
    if (rec.sessionKey !== sessionKey) continue;
    if (latest === null || rec.at > latest.at) latest = rec;
  }

  return latest;
}

/** Prune expired entries and cap the map size so it cannot grow unbounded. */
function pruneRecentDownloads(now: number): void {
  for (const [key, rec] of recentDownloads) {
    if (now - rec.at > DEDUP_WINDOW_MS) recentDownloads.delete(key);
  }

  while (recentDownloads.size >= MAX_RECENT_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [key, rec] of recentDownloads) {
      if (rec.at < oldestAt) {
        oldestAt = rec.at;
        oldestKey = key;
      }
    }
    if (oldestKey === null) break;
    recentDownloads.delete(oldestKey);
  }
}

function rememberDownload(
  sessionKey: string,
  query: string,
  format: string,
  asDocument: boolean,
  result: ToolExecuteResult,
): void {
  const now = Date.now();
  pruneRecentDownloads(now);
  recentDownloads.set(getDedupKey(sessionKey, query, format, asDocument), {
    sessionKey,
    query,
    format,
    asDocument,
    result,
    at: now,
  });
}

// In-flight single-flight lock: AI SDK may execute several tool calls in
// parallel (Promise.all). Without this, two near-identical queries could both
// pass the dedup check before either finishes and is remembered.
const inflight = new Map<string, Promise<ToolExecuteResult>>();

/** Inputs to a download run, grouped to avoid long positional parameter lists. */
interface DownloadParams {
  input: string;
  rawUserMessage: string;
  format: string;
  quality: string;
  asDocument: boolean;
  sessionKey: string;
  context: ToolContext;
}

/**
 * Core download logic. Extracted from the `execute` wrapper so the wrapper
 * can apply single-flight dedup and the recent-download guard.
 */
async function doDownloadYoutube(params: DownloadParams): Promise<ToolExecuteResult> {
  const { input, rawUserMessage, format, quality, asDocument, sessionKey, context } = params;

  const duplicate = findRecentDownload(sessionKey, input, format, asDocument);
  if (duplicate) {
    log.warn(
      `[Tool:YouTube] ⏭️ Duplicate query for "${sessionKey}": "${input}" → reusing "${duplicate.query}" (no re-download)`,
    );
    return {
      ...duplicate.result,
      message: `Sudah didownload sebelumnya ("${duplicate.query}"). ${duplicate.result.message}`,
    };
  }

  log.info(
    `[Tool:YouTube] 🎥 Downloading: ${input} (format: ${format}, quality: ${quality}${asDocument ? ', asDocument' : ''})`,
  );

  try {
    const { youtubeDl } = await import('youtube-dl-exec');
    const tempDir = path.join(process.cwd(), 'temp');

    await fs.mkdir(tempDir, { recursive: true });

    const initialInfo = await resolveYoutubeInput(youtubeDl as any, input, tempDir);
    const resolvedUrl = initialInfo?.webpage_url ||
      (initialInfo?.id ? `https://www.youtube.com/watch?v=${initialInfo.id}` : isYouTubeUrl(input) ? normalizeYouTubeUrl(input) : input);

    // Get complete video info first. Search results can be partial.
    const info = isYouTubeUrl(resolvedUrl)
      ? await youtubeDl(resolvedUrl, {
        ...baseYoutubeDlFlags,
        dumpJson: true,
      }, { cwd: tempDir }) as YoutubeDlInfo
      : initialInfo;

    if (!info || !info.title) {
      return { success: false, message: 'Gagal menemukan video YouTube dari URL atau judul yang diberikan.' };
    }

    const title = info.title || 'Unknown';
    const uploader = info.uploader || 'Unknown';
    const duration = info.duration || 0;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    // Download
    const downloadFlags: Record<string, any> = {
      ...baseYoutubeDlFlags,
      output: path.join(tempDir, `${info.id || 'video'}.%(ext)s`),
    };

    if (format === 'audio') {
      downloadFlags.extractAudio = true;
      downloadFlags.audioFormat = 'mp3';
      downloadFlags.audioQuality = 0;
    } else {
      if (quality === 'best') {
        downloadFlags.format = 'bestvideo+bestaudio/best';
      } else {
        downloadFlags.format = `bestvideo[height<=${quality.replace('p', '')}]+bestaudio/best[height<=${quality.replace('p', '')}]`;
      }
      downloadFlags.mergeOutputFormat = 'mp4';
    }

    await youtubeDl(resolvedUrl, downloadFlags, { cwd: tempDir });

    const ext = format === 'audio' ? 'mp3' : 'mp4';
    const filePath = path.join(tempDir, `${info.id || 'video'}.${ext}`);
    const stats = await fs.stat(filePath);

    // Document mode: 2GB limit, regular mode: 50MB limit (WhatsApp media cap)
    const sizeLimit = asDocument ? 2000 * 1024 * 1024 : 50 * 1024 * 1024;
    if (stats.size > sizeLimit) {
      await fs.unlink(filePath);
      const limitMb = asDocument ? 2000 : 50;
      return {
        success: false,
        message: `File terlalu besar (${(stats.size / 1024 / 1024).toFixed(2)}MB). WhatsApp memiliki batas ${limitMb}MB.`,
        data: { title, uploader, duration: durationStr, fileSize: stats.size },
      };
    }

    if (context.socket && context.fromJid) {
      const caption = `🎥 YouTube ${format === 'audio' ? 'Audio' : 'Video'}\n\n` +
        `📌 ${title}\n` +
        `👤 ${uploader}\n` +
        `⏱️ ${durationStr}\n` +
        `🎚️ ${quality}\n` +
        `📦 ${(stats.size / 1024 / 1024).toFixed(2)}MB\n\n` +
        `_Downloaded via AI_`;

      if (asDocument) {
        // Send as document for files up to 2GB
        await context.socket.sendMessage(context.fromJid, {
          document: { url: filePath },
          mimetype: format === 'audio' ? 'audio/mpeg' : 'video/mp4',
          fileName: `${title}.${ext}`,
          caption,
        });
      } else if (format === 'audio') {
        await context.socket.sendMessage(context.fromJid, {
          audio: { url: filePath },
          mimetype: 'audio/mpeg',
        });
      } else {
        await context.socket.sendMessage(context.fromJid, {
          video: { url: filePath },
          caption,
          mimetype: 'video/mp4',
        });
      }

      // Clean up temp file after the WhatsApp upload window has passed.
      setTimeout(async () => {
        try { await fs.unlink(filePath); } catch {}
      }, TEMP_FILE_CLEANUP_MS);
    }

    const result: ToolExecuteResult = {
      success: true,
      message: `Berhasil mendownload ${format === 'audio' ? 'audio' : 'video'} YouTube "${title}". Media sudah dikirim ke user.`,
      data: { title, uploader, duration: durationStr, format, quality, fileSize: stats.size, asDocument, resolvedUrl },
    };

    rememberDownload(sessionKey, input, format, asDocument, result);

    return result;
  } catch (error: unknown) {
    log.error('[Tool:YouTube] Download error:', {
      error: error instanceof Error ? error.message : String(error),
    });

    let errorMessage = 'Gagal mendownload dari YouTube.';
    if (typeof error === 'object' && error !== null && 'stderr' in error) {
      const stderr = String((error as { stderr?: unknown }).stderr ?? '');
      if (stderr.includes('Video unavailable')) errorMessage = 'Video tidak tersedia atau telah dihapus.';
      else if (stderr.includes('Private video')) errorMessage = 'Video ini bersifat privat.';
      else if (stderr.includes('not available')) errorMessage = 'Video tidak tersedia di wilayah ini.';
    }

    return {
      success: false,
      message: errorMessage,
    };
  }
}

export const execute: ToolExecuteFunction = async (args, context) => {
  const sessionKey = context.sessionId || context.fromJid || 'global';

  let input = (args.query as string | undefined)?.trim();

  // Query recovery: follow-up requests like "versi dokumennya juga dong"
  // often omit `query` because the model assumes context. If empty, reuse the
  // most recent successful download query for this session so the request
  // still works instead of failing on a missing query.
  if (!input) {
    const latest = findLatestDownload(sessionKey);
    if (latest) {
      log.warn(
        `[Tool:YouTube] 🔁 Query kosong → memakai judul terakhir "${latest.query}" dari sesi ini`,
      );
      input = latest.query;
    }
  }

  if (!input) {
    log.warn('[Tool:YouTube] ❌ download_youtube dipanggil tanpa `query`. Memberi tahu model untuk menyertakan judul/URL.');
    return {
      success: false,
      message:
        'Argumen `query` kosong. download_youtube membutuhkan judul lagu atau URL YouTube. Panggil ulang dengan menyertakan `query` (dan `format`: "audio" untuk lagu, as_document: true jika diminta sebagai dokumen).',
    };
  }

  const rawUserMessage = typeof context.userMessage === 'string' ? context.userMessage : '';

  const explicitFormat = args.format as string | undefined;
  const format = explicitFormat || 'video';
  const quality = (args.quality as string) || 'best';

  // Fallback #1: if the model missed `as_document` but the user explicitly
  // asked for a document/file, force document mode.
  let asDocument = args.as_document === true;
  if (!asDocument && hasDocumentIntent(rawUserMessage)) {
    asDocument = true;
  }

  // Fallback #2: if the model picked "video" but the user asked for a song,
  // force audio mode (prevents a song from arriving as a video).
  let resolvedFormat =
    format === 'video' && hasAudioIntent(rawUserMessage) ? 'audio' : format;

  // Format inheritance: follow-up requests (e.g. "versi dokumennya juga dong")
  // often omit `format`, which would silently default to "video" for a song
  // that was previously downloaded as audio. If the same song was downloaded
  // in this session before, reuse its format.
  if (!explicitFormat && resolvedFormat === 'video') {
    const prev = findRecentDownload(sessionKey, input, null, asDocument);
    if (prev && prev.format !== 'video') {
      log.info(
        `[Tool:YouTube] 🧭 Inheriting format "${prev.format}" from previous download of "${prev.query}"`,
      );
      resolvedFormat = prev.format;
    }
  }

  // In-flight dedup: if the exact same normalized query is already being
  // downloaded for this session, await that same promise instead of starting
  // a second download (parallel tool calls would otherwise race past the
  // recent-download check below).
  const inflightKey = getDedupKey(sessionKey, input, resolvedFormat, asDocument);
  const existing = inflight.get(inflightKey);
  if (existing) {
    log.warn(
      `[Tool:YouTube] ⏭️ In-flight duplicate for "${sessionKey}": "${input}" → awaiting existing download`,
    );
    return existing;
  }

  const run = doDownloadYoutube({
    input,
    rawUserMessage,
    format: resolvedFormat,
    quality,
    asDocument,
    sessionKey,
    context,
  });

  // Only one in-flight per normalized query per session; clean up when done.
  inflight.set(inflightKey, run);
  run.finally(() => {
    if (inflight.get(inflightKey) === run) inflight.delete(inflightKey);
  }).catch(() => {});

  return run;
};
