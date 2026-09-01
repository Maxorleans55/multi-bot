import nexo from 'nexo-aio-downloader';
import { createRequire } from 'module';
import instagramDownload, { cleanupMergedFile } from '../../utils/instagram.js';
import type { AIToolDefinition, ToolExecuteFunction, ToolContext } from '../../types/tools.js';
import {
  getTwitterInfo,
  downloadTwitterMedia,
  buildTwitterCaption,
  parseTwitterError,
  detectFileType,
  scheduleFileCleanup,
} from '../../utils/twitterDownloader.js';

const require = createRequire(import.meta.url);
const Tiktok = require('@tobyg74/tiktok-api-dl');

type Platform = 'tiktok' | 'instagram' | 'facebook' | 'twitter';

function detectPlatform(url: string): Platform | null {
  const lower = url.toLowerCase();
  if (lower.includes('tiktok.com') || lower.includes('vm.tiktok.com')) return 'tiktok';
  if (lower.includes('instagram.com') || lower.includes('instagr.am')) return 'instagram';
  if (lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('fb.com')) return 'facebook';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter';
  return null;
}

// ─── Instagram ───────────────────────────────────────────────────────────────

async function handleInstagram(url: string, context: ToolContext) {
  const result = await instagramDownload(url);

  if (result.status && result.data) {
    const { url: urls, isVideo, caption: captionText, mergedFilePath } = result.data;

    if (context.socket && context.fromJid) {
      // For DASH video with merged file, send the local file (has audio+video)
      if (isVideo && mergedFilePath) {
        const cap = `📸 Instagram Video${captionText ? `\n\n${captionText}` : ''}\n\n_Downloaded via AI_`;
        try {
          await context.socket.sendMessage(context.fromJid, {
            video: { url: mergedFilePath },
            caption: cap,
            mimetype: 'video/mp4',
          });
        } finally {
          setTimeout(() => cleanupMergedFile(mergedFilePath), 60_000);
        }

        return {
          success: true,
          message: 'Berhasil mendownload video dari Instagram. Media sudah dikirim ke user.',
          data: { type: 'video', urls },
        };
      }

      // Video without a playable single-file URL — the DASH merge failed or the
      // post returned no direct stream. Don't silently send nothing.
      if (isVideo && urls.length === 0) {
        return {
          success: false,
          message: 'Failed to download Instagram video: no valid video stream found (unsupported codec or private post).',
        };
      }

      // Non-DASH: send raw URLs
      for (let i = 0; i < urls.length; i++) {
        const cap = i === 0
          ? `📸 Instagram ${isVideo ? 'Video' : 'Photo'}${captionText ? `\n\n${captionText}` : ''}\n\n_Downloaded via AI_`
          : undefined;

        if (isVideo) {
          await context.socket.sendMessage(context.fromJid, {
            video: { url: urls[i] },
            ...(cap ? { caption: cap } : {}),
          });
        } else {
          await context.socket.sendMessage(context.fromJid, {
            image: { url: urls[i] },
            ...(cap ? { caption: cap } : {}),
          });
        }
      }
    }

    return {
      success: true,
      message: `Successfully downloaded ${urls.length} ${isVideo ? 'video(s)' : 'photo(s)'} from Instagram. Media has been sent to user.`,
      data: { type: isVideo ? 'video' : 'image', urls },
    };
  }

  return {
    success: false,
    message: result.message || 'Failed to fetch media from Instagram. Link may be invalid, private, or media not found.',
  };
}

// ─── Facebook ────────────────────────────────────────────────────────────────

async function handleFacebook(url: string, context: ToolContext) {
  const result = await nexo.facebook(url);

  if (result.data?.result && result.data.result.length > 0) {
    const mediaUrl = result.data.result[0].url;

    if (context.socket && context.fromJid) {
      await context.socket.sendMessage(context.fromJid, {
        video: { url: mediaUrl },
        caption: `📘 Facebook Video\n\n_Downloaded via AI_`,
      });
    }

    return {
      success: true,
      message: 'Successfully downloaded video from Facebook. Media has been sent to user.',
      data: { type: 'video', url: mediaUrl },
    };
  }

  return {
    success: false,
    message: 'Failed to fetch video from Facebook. Link may be invalid, private, or video not found.',
  };
}

// ─── Twitter / X ─────────────────────────────────────────────────────────────

async function handleTwitter(url: string, context: ToolContext) {
  try {
    // Step 1: Get tweet info
    const info = await getTwitterInfo(url);

    if (!info || !info.title) {
      return {
        success: false,
        message: 'Failed to get tweet info. URL may be invalid.',
      };
    }

    // Step 2: Download media
    const result = await downloadTwitterMedia(url, info);

    if (!result.success || !result.filePath) {
      return {
        success: false,
        message: result.error || 'Failed to download media from Twitter/X.',
      };
    }

    // Step 3: Send media to user
    const caption = buildTwitterCaption(
      result.info || info,
      result.fileSize || 0,
      info.duration,
      '_Downloaded via AI_'
    );

    const fileType = result.fileType || detectFileType(result.fileExt || '');
    let mediaType = 'video';

    if (context.socket && context.fromJid) {
      switch (fileType) {
        case 'image':
          await context.socket.sendMessage(context.fromJid, { image: { url: result.filePath }, caption });
          mediaType = 'image';
          break;
        case 'video':
          await context.socket.sendMessage(context.fromJid, { video: { url: result.filePath }, caption, mimetype: 'video/mp4' });
          break;
        case 'audio':
          await context.socket.sendMessage(context.fromJid, { audio: { url: result.filePath }, mimetype: 'audio/mpeg' });
          mediaType = 'audio';
          break;
        default:
          await context.socket.sendMessage(context.fromJid, {
            document: { url: result.filePath },
            mimetype: 'application/octet-stream',
            fileName: `twitter_media${result.fileExt || ''}`,
            caption,
          });
          break;
      }
    }

    // Step 4: Cleanup
    scheduleFileCleanup(result.filePath);

    return {
      success: true,
      message: 'Berhasil mendownload media dari Twitter/X. Media sudah dikirim ke user.',
      data: { type: mediaType, url: result.filePath },
    };
  } catch (error: any) {
    console.error('[Tool:Twitter] Download error:', error);
    return {
      success: false,
      message: parseTwitterError(error),
    };
  }
}

// ─── TikTok ──────────────────────────────────────────────────────────────────

async function handleTiktok(url: string, context: ToolContext) {
  const result = await Tiktok.Downloader(url, { version: 'v1' });

  if (result.status === 'success' && result.result) {
    const data = result.result;
    const caption =
      `🎵 *TikTok Download*\n\n` +
      `👤 *Author:* ${data.author?.nickname || 'Unknown'} (@${data.author?.username || 'unknown'})\n` +
      `❤️ *Likes:* ${data.statistics?.likeCount || 0}\n` +
      (data.statistics?.commentCount ? `💬 *Comments:* ${data.statistics.commentCount}\n` : '') +
      (data.statistics?.shareCount ? `🔗 *Shares:* ${data.statistics.shareCount}\n` : '') +
      `\n_Downloaded via AI_`;

    if (data.type === 'video' && data.video?.playAddr?.[0]) {
      const videoUrl = data.video.playAddr[0];

      if (context.socket && context.fromJid) {
        await context.socket.sendMessage(context.fromJid, {
          video: { url: videoUrl },
          caption,
        });
      }

      return {
        success: true,
        message: 'Berhasil mendownload video TikTok. Media sudah dikirim ke user.',
        data: { type: 'video', url: videoUrl },
      };
    } else if (data.type === 'image' && data.images?.length > 0) {
      if (context.socket && context.fromJid) {
        for (const imageUrl of data.images) {
          await context.socket.sendMessage(context.fromJid, {
            image: { url: imageUrl },
            caption,
          });
        }
      }

      return {
        success: true,
        message: `Successfully downloaded ${data.images.length} photos from TikTok. Media has been sent to user.`,
        data: { type: 'images', count: data.images.length, urls: data.images },
      };
    }
  }

  return {
    success: false,
    message: 'Gagal mengambil media dari TikTok. Link mungkin tidak valid atau video tidak tersedia.',
  };
}

// ─── Registry ────────────────────────────────────────────────────────────────

const handlers: Record<Platform, (url: string, context: ToolContext) => Promise<any>> = {
  instagram: handleInstagram,
  facebook: handleFacebook,
  twitter: handleTwitter,
  tiktok: handleTiktok,
};

const platformNames: Record<Platform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'Twitter/X',
  tiktok: 'TikTok',
};

// ─── Definition ──────────────────────────────────────────────────────────────

export const definition: AIToolDefinition = {
  type: 'function',
  function: {
    name: 'download_social_media',
    description:
      'Download video or images from TikTok, Instagram, Facebook, or Twitter/X. Provide a valid URL and the platform will be detected automatically.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description:
            'The full URL to download media from. Supports TikTok, Instagram, Facebook, and Twitter/X URLs (e.g. https://tiktok.com/@user/video/xxx, https://instagram.com/p/xxx, https://facebook.com/watch?v=xxx, https://twitter.com/user/status/xxx, https://x.com/user/status/xxx)',
        },
      },
      required: ['url'],
    },
  },
};

// ─── Execute ─────────────────────────────────────────────────────────────────

export const execute: ToolExecuteFunction = async (args, context) => {
  const url = args.url as string;
  if (!url) {
    return { success: false, message: 'URL not provided.' };
  }

  console.log(`[Tool:Social] 📥 Downloading: ${url}`);

  const platform = detectPlatform(url);
  if (!platform) {
    return {
      success: false,
      message: 'URL not recognized. Make sure the URL is from TikTok, Instagram, Facebook, or Twitter/X.',
    };
  }

  try {
    return await handlers[platform](url, context);
  } catch (error: any) {
    const platformName = platformNames[platform];
    console.error(`[Tool:${platformName}] Download error:`, error);
    return {
      success: false,
      message: `Gagal mendownload dari ${platformName}: ${error.message || 'Unknown error'}`,
    };
  }
};
