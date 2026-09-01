import nexo from 'nexo-aio-downloader';
import instagramDownload, { cleanupMergedFile } from '../utils/instagram.js';
import type { WASocket } from '@whiskeysockets/baileys';
import { createRequire } from 'module';
import {
  getTwitterInfo,
  downloadTwitterMedia,
  buildTwitterCaption,
  parseTwitterError,
  detectFileType,
  scheduleFileCleanup,
} from '../utils/twitterDownloader.js';

const require = createRequire(import.meta.url);
const Tiktok = require('@tobyg74/tiktok-api-dl');

export type SocialMediaPlatform = 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'twitter' | 'unknown';

export interface SocialMediaLink {
  platform: SocialMediaPlatform;
  url: string;
}

export interface DownloadResult {
  success: boolean;
  url?: string;
  type?: 'video' | 'image' | 'audio';
  error?: string;
}

/**
 * Send error message to user
 */
async function sendErrorMessage(socket: WASocket, fromJid: string, message: string): Promise<void> {
  await socket.sendMessage(fromJid, { text: message });
}

/**
 * Detect social media links from text
 */
export function detectSocialMediaLink(text: string): SocialMediaLink | null {
  if (!text) return null;

  const patterns = {
    instagram: /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/[\w-]+(?:\/[\w.-]+)*/i,
    tiktok: /(?:https?:\/\/)?(?:www\.)?(?:tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)\/(?:@[\w.-]+\/[\w-]+(?:\/[\w-]+)*|[\w-]+)/i,
    youtube: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+(?:[?&][\w.-]+)*/i,
    facebook: /(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.watch)\/[\w.-]+(?:\/[\w.-]+)*/i,
    twitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/[\w.-]+\/status\/[\w-]+(?:\/[\w.-]+)*/i,
  };

  for (const [platform, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    if (match) {
      return {
        platform: platform as SocialMediaPlatform,
        url: match[0],
      };
    }
  }

  return null;
}

/**
 * Download media from social media platform
 */
export async function downloadFromSocialMedia(
  link: SocialMediaLink,
  socket: WASocket,
  fromJid: string
): Promise<DownloadResult> {
  try {
    await socket.sendMessage(fromJid, {
      text: '⏳ Detecting link, please wait...',
    });

    switch (link.platform) {
      case 'instagram':
        return await downloadInstagram(link.url, socket, fromJid);
      case 'tiktok':
        return await downloadTikTok(link.url, socket, fromJid);
      case 'youtube':
        return await downloadYouTube(link.url, socket, fromJid);
      case 'facebook':
        return await downloadFacebook(link.url, socket, fromJid);
      case 'twitter':
        return await downloadTwitter(link.url, socket, fromJid);
      default:
        return {
          success: false,
          error: 'Platform not supported',
        };
    }
  } catch (error) {
    console.error('Error downloading from social media:', error);
    await sendErrorMessage(socket, fromJid, '❌ Failed to download media. A system error occurred.');
    return {
      success: false,
      error: 'Gagal mendownload media',
    };
  }
}

async function downloadInstagram(url: string, socket: WASocket, fromJid: string): Promise<DownloadResult> {
  try {
    const startTime = Date.now();
    const result = await instagramDownload(url);

    if (!result.status || !result.data) {
      await sendErrorMessage(
        socket,
        fromJid,
        `❌ ${result.message || 'Failed to fetch media from Instagram. Invalid link or media not found.'}`,
      );
      return { success: false, error: 'Failed to fetch media from Instagram' };
    }

    const { url: urls, isVideo, caption: captionText, mergedFilePath } = result.data;
    const processTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // DASH video — send the merged local file (single message, no spam)
    if (isVideo && mergedFilePath) {
      const cap = `📸 Instagram Video${captionText ? `\n\n${captionText}` : ''}\n\n⏱️ Process Time: ${processTime} seconds\n\n_Downloaded automatically_`;
      try {
        await socket.sendMessage(fromJid, {
          video: { url: mergedFilePath },
          caption: cap,
          mimetype: 'video/mp4',
        });
      } finally {
        setTimeout(() => cleanupMergedFile(mergedFilePath), 60_000);
      }
      return { success: true, url: mergedFilePath, type: 'video' };
    }

    // Video without a playable single-file URL — the DASH merge failed or the
    // post returned no direct stream. Don't silently send nothing.
    if (isVideo && urls.length === 0) {
      await sendErrorMessage(
        socket,
        fromJid,
        '❌ Failed to download Instagram video: no valid video stream found (unsupported codec or private post). Try again, or contact the Owner if the problem persists.',
      );
      return { success: false, error: 'Failed to download Instagram video: no valid video stream' };
    }

    // Non-DASH: send one message per URL (carousel images, single-file videos)
    if (urls.length > 0) {
      for (let i = 0; i < urls.length; i++) {
        const cap = i === 0
          ? `📸 Instagram ${isVideo ? 'Video' : 'Photo'}${captionText ? `\n\n${captionText}` : ''}\n\n⏱️ Process Time: ${processTime} seconds\n\n_Downloaded automatically_`
          : undefined;

        if (isVideo) {
          await socket.sendMessage(fromJid, {
            video: { url: urls[i] },
            ...(cap ? { caption: cap } : {}),
          });
        } else {
          await socket.sendMessage(fromJid, {
            image: { url: urls[i] },
            ...(cap ? { caption: cap } : {}),
          });
        }
      }
      return { success: true, url: urls[0], type: isVideo ? 'video' : 'image' };
    }

    await sendErrorMessage(
      socket,
      fromJid,
      `❌ ${result.message || 'Failed to fetch media from Instagram. Invalid link or media not found.'}`,
    );
    return { success: false, error: 'Failed to fetch media from Instagram' };
  } catch (error) {
    console.error('Instagram download error:', error);
    await sendErrorMessage(socket, fromJid, '❌ Failed to download from Instagram. Link may be private or invalid.');
    return { success: false, error: 'Failed to download from Instagram' };
  }
}

async function downloadTikTok(url: string, socket: WASocket, fromJid: string): Promise<DownloadResult> {
  try {
    const startTime = Date.now();
    console.log('Downloading TikTok:', url);
    const result = await Tiktok.Downloader(url, {
      version: 'v1',
    });

    if (result.status !== 'success') {
      await sendErrorMessage(socket, fromJid, '❌ Failed to fetch media from TikTok. Invalid link or media not found.');
      return {
        success: false,
        error: 'Failed to fetch media from TikTok',
      };
    }

    if (result.status === 'success' && result.result) {
      const data = result.result;
      const processTime = ((Date.now() - startTime) / 1000).toFixed(2);
      const caption = `🎵 *TikTok Download*\n\n` +
        `👤 *Author:* ${data.author.nickname} (@${data.author.username})\n` +
        `❤️ *Likes:* ${data.statistics.likeCount}\n` +
        `💬 *Comments:* ${data.statistics.commentCount}\n` +
        `🔗 *Shares:* ${data.statistics.shareCount}\n\n` +
        `⏱️ *Process Time:* ${processTime} seconds\n\n_Downloaded automatically_`;

      if (data.type === 'video' && data.video) {
        const videoUrl = data.video.playAddr[0];

        if (!videoUrl) {
          await sendErrorMessage(socket, fromJid, '❌ Failed to fetch media from TikTok: video URL not found.');
          return {
            success: false,
            error: 'Failed to fetch media from TikTok: URL not found',
          };
        }

        await socket.sendMessage(fromJid, {
          video: { url: videoUrl },
          caption: caption,
        });

        return {
          success: true,
          url: videoUrl,
          type: 'video',
        };
      } else if (data.type === 'image' && data.images && data.images.length > 0) {
        const imageUrl = data.images[0];
        await socket.sendMessage(fromJid, {
          image: { url: imageUrl },
          caption: caption,
        });

        return {
          success: true,
          url: imageUrl,
          type: 'image',
        };
      }
    }

    await sendErrorMessage(socket, fromJid, '❌ Failed to fetch media from TikTok. Media not found.');
    return {
      success: false,
      error: 'Failed to fetch media from TikTok',
    };
  } catch (error) {
    console.error('TikTok download error:', error);
    await sendErrorMessage(socket, fromJid, '❌ Failed to download from TikTok. Link may be private or invalid.');
    return {
      success: false,
      error: 'Failed to download from TikTok',
    };
  }
}

async function downloadYouTube(url: string, socket: WASocket, fromJid: string): Promise<DownloadResult> {
  try {
    const startTime = Date.now();
    const result = await nexo.youtube(url);

    if (result.data?.result) {
      const processTime = ((Date.now() - startTime) / 1000).toFixed(2);
      await socket.sendMessage(fromJid, {
        text: `🎥 YouTube download is not fully implemented yet. Use the !youtube command for manual download.\n\n⏱️ Process Time: ${processTime} seconds`,
      });
      return {
        success: false,
        error: 'YouTube auto-download feature not available yet',
      };
    }

    await sendErrorMessage(socket, fromJid, '❌ Failed to fetch media from YouTube. Invalid link.');

    return {
      success: false,
      error: 'Failed to fetch media from YouTube',
    };
  } catch (error) {
    console.error('YouTube download error:', error);
    await sendErrorMessage(socket, fromJid, '❌ Failed to download from YouTube. Link may be invalid.');
    return {
      success: false,
      error: 'Failed to download from YouTube',
    };
  }
}

async function downloadFacebook(url: string, socket: WASocket, fromJid: string): Promise<DownloadResult> {
  try {
    const startTime = Date.now();
    const result = await nexo.facebook(url);

    if (result.data?.result && result.data.result.length > 0) {
      const mediaUrl = result.data.result[0].url;
      const processTime = ((Date.now() - startTime) / 1000).toFixed(2);

      await socket.sendMessage(fromJid, {
        video: { url: mediaUrl },
        caption: `📘 Facebook Video\n\n⏱️ Process Time: ${processTime} seconds\n\n_Downloaded automatically_`,
      });

      return {
        success: true,
        url: mediaUrl,
        type: 'video',
      };
    }

    await sendErrorMessage(socket, fromJid, '❌ Failed to fetch media from Facebook. Invalid link or media not found.');
    return {
      success: false,
      error: 'Failed to fetch media from Facebook',
    };
  } catch (error) {
    console.error('Facebook download error:', error);
    await sendErrorMessage(socket, fromJid, '❌ Failed to download from Facebook. Link may be private or invalid.');
    return {
      success: false,
      error: 'Failed to download from Facebook',
    };
  }
}

async function downloadTwitter(url: string, socket: WASocket, fromJid: string): Promise<DownloadResult> {
  try {
    await socket.sendMessage(fromJid, {
      text: '⏳ Downloading media from Twitter/X...',
    });

    // Step 1: Get tweet info
    const info = await getTwitterInfo(url);

    if (!info || !info.title) {
      await sendErrorMessage(socket, fromJid, '❌ Failed to get tweet info. URL may be invalid.');
      return { success: false, error: 'Failed to get tweet info' };
    }

    // Step 2: Download media
    const result = await downloadTwitterMedia(url, info);

    if (!result.success || !result.filePath) {
      if (result.error?.includes('No media')) {
        await socket.sendMessage(fromJid, {
          text: `📝 *Tweet Info*\n\n👤 ${info.uploader || 'Unknown'} (@${info.uploader_id || 'unknown'})\n📄 ${info.title || ''}\n\n❌ No media available to download from this tweet.`,
        });
      } else if (result.error?.includes('too large')) {
        await sendErrorMessage(socket, fromJid, `⚠️ ${result.error}`);
      } else {
        await sendErrorMessage(socket, fromJid, `❌ ${result.error}`);
      }
      return { success: false, error: result.error || 'Failed to download Twitter' };
    }

    // Step 3: Send media to user
    const caption = buildTwitterCaption(
      result.info || info,
      result.fileSize || 0,
      info.duration,
      '_Downloaded automatically_'
    );

    const fileType = result.fileType || detectFileType(result.fileExt || '');

    switch (fileType) {
      case 'image':
        await socket.sendMessage(fromJid, { image: { url: result.filePath }, caption });
        break;
      case 'video':
        await socket.sendMessage(fromJid, { video: { url: result.filePath }, caption, mimetype: 'video/mp4' });
        break;
      case 'audio':
        await socket.sendMessage(fromJid, { audio: { url: result.filePath }, mimetype: 'audio/mpeg' });
        break;
      default:
        await socket.sendMessage(fromJid, {
          document: { url: result.filePath },
          mimetype: 'application/octet-stream',
          fileName: `twitter_media${result.fileExt || ''}`,
          caption,
        });
        break;
    }

    // Step 4: Cleanup
    scheduleFileCleanup(result.filePath);

    return {
      success: true,
      url: result.filePath,
      type: fileType === 'document' ? 'video' : fileType,
    };
  } catch (error: any) {
    console.error('Twitter download error:', error);
    const errorMsg = parseTwitterError(error);
    await sendErrorMessage(socket, fromJid, `❌ ${errorMsg}`);
    return { success: false, error: 'Failed to download from Twitter' };
  }
}
