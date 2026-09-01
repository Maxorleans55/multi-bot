import { youtubeDl, type Flags } from 'youtube-dl-exec';
import { promises as fs } from 'fs';
import path from 'path';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TwitterMediaInfo {
  id?: string;
  title?: string;
  uploader?: string;
  uploader_id?: string;
  thumbnail?: string;
  duration?: number;
  formats?: Array<{
    format_id: string;
    url?: string;
    ext?: string;
    width?: number;
    height?: number;
    filesize?: number;
    vcodec?: string;
    acodec?: string;
  }>;
  webpage_url?: string;
  extractor?: string;
}

export interface TwitterDownloadResult {
  success: boolean;
  error?: string;
  filePath?: string;
  fileType?: 'video' | 'image' | 'audio' | 'document';
  fileExt?: string;
  fileSize?: number;
  info?: TwitterMediaInfo;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
const AUDIO_EXTS = ['.mp3', '.m4a', '.aac', '.ogg', '.wav'];
const SIZE_LIMIT = 50 * 1024 * 1024; // 50MB WhatsApp media limit

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Detect file type from extension
 */
export function detectFileType(ext: string): 'video' | 'image' | 'audio' | 'document' {
  const lower = ext.toLowerCase();
  if (IMAGE_EXTS.includes(lower)) return 'image';
  if (VIDEO_EXTS.includes(lower)) return 'video';
  if (AUDIO_EXTS.includes(lower)) return 'audio';
  return 'document';
}

/**
 * Build Twitter/X download caption
 */
export function buildTwitterCaption(
  info: TwitterMediaInfo,
  fileSize: number,
  duration?: number,
  suffix?: string
): string {
  const lines: string[] = [
    `🐦 *Twitter/X Download*`,
    ``,
    `👤 *${info.uploader || 'Unknown'}* (@${info.uploader_id || 'unknown'})`,
    `📄 ${(info.title || '').substring(0, 100)}${(info.title || '').length > 100 ? '...' : ''}`,
    `📦 ${(fileSize / 1024 / 1024).toFixed(2)}MB`,
  ];

  if (duration) {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    lines.push(`⏱️ ${mins}:${secs.toString().padStart(2, '0')}`);
  }

  if (suffix) {
    lines.push(``, suffix);
  }

  return lines.join('\n');
}

/**
 * Parse yt-dlp error stderr into a user-friendly message
 */
export function parseTwitterError(error: any): string {
  const stderr = error?.stderr || '';
  if (stderr.includes('Unsupported URL') || stderr.includes('no matching extractor')) {
    return 'Invalid or unsupported Twitter/X URL.';
  }
  if (stderr.includes('does not exist') || stderr.includes('Not Found')) {
    return 'Tweet not found. It may have been deleted.';
  }
  return 'Failed to download media from Twitter/X. Make sure the URL is correct and the tweet contains media.';
}

/**
 * Validate Twitter/X URL format
 */
export function isValidTwitterUrl(url: string): boolean {
  return /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[\w.-]+\/status\/\d+/i.test(url);
}

// ─── Core download logic ────────────────────────────────────────────────────

/**
 * Fetch tweet metadata using yt-dlp (dumpJson mode, no download)
 */
export async function getTwitterInfo(url: string): Promise<TwitterMediaInfo> {
  const tempDir = path.join(process.cwd(), 'temp');
  await fs.mkdir(tempDir, { recursive: true });

  const info: TwitterMediaInfo = await youtubeDl(url, {
    noWarnings: true,
    noCheckCertificates: true,
    preferFreeFormats: true,
    dumpJson: true,
  }, { cwd: tempDir }) as TwitterMediaInfo;

  return info;
}

/**
 * Download media from Twitter/X using yt-dlp.
 * Returns the path to the downloaded file.
 */
export async function downloadTwitterMedia(url: string, info: TwitterMediaInfo): Promise<TwitterDownloadResult> {
  const tempDir = path.join(process.cwd(), 'temp');
  await fs.mkdir(tempDir, { recursive: true });

  const outputBase = path.join(tempDir, `twitter_${info.id || 'media'}.%(ext)s`);

  // Check if there are formats (media) available
  const hasFormats = info.formats && info.formats.length > 0;
  if (!hasFormats && !info.thumbnail) {
    return {
      success: false,
      error: 'No media available to download from this tweet.',
      info,
    };
  }

  // Try download with bestvideo+bestaudio first
  const downloadFlags: Flags = {
    noWarnings: true,
    noCheckCertificates: true,
    preferFreeFormats: true,
    output: outputBase,
    format: 'bestvideo+bestaudio/best',
    mergeOutputFormat: 'mp4',
  };

  try {
    await youtubeDl(url, downloadFlags, { cwd: tempDir });
  } catch {
    // If merge fails, try without merge (single format)
    try {
      const fallbackFlags: Flags = {
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        output: outputBase,
        format: 'best',
      };
      await youtubeDl(url, fallbackFlags, { cwd: tempDir });
    } catch {
      return {
        success: false,
        error: 'Failed to download media from Twitter/X.',
        info,
      };
    }
  }

  // Find the downloaded file
  const prefix = `twitter_${info.id || 'media'}`;
  const tempFiles = await fs.readdir(tempDir);
  const downloadedFile = tempFiles.find(f => f.startsWith(prefix) && !f.endsWith('.part') && !f.endsWith('.tmp'));

  if (!downloadedFile) {
    return {
      success: false,
      error: 'File not found after download.',
      info,
    };
  }

  const filePath = path.join(tempDir, downloadedFile);

  try {
    const stats = await fs.stat(filePath);

    if (stats.size > SIZE_LIMIT) {
      await fs.unlink(filePath);
      return {
        success: false,
        error: `File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). WhatsApp limit is 50MB.`,
        info,
      };
    }

    const ext = path.extname(downloadedFile).toLowerCase();
    const fileType = detectFileType(ext);

    return {
      success: true,
      filePath,
      fileType,
      fileExt: ext,
      fileSize: stats.size,
      info,
    };
  } catch {
    return {
      success: false,
      error: 'Failed to read the downloaded file.',
      info,
    };
  }
}

/**
 * Schedule cleanup of downloaded file after a delay (default: 30s)
 */
export function scheduleFileCleanup(filePath: string, delayMs: number = 30000): void {
  setTimeout(async () => {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Failed to cleanup Twitter media:', error);
    }
  }, delayMs);
}
