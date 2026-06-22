import nexo from 'nexo-aio-downloader';
import { createRequire } from 'module';
import type { AIToolDefinition, ToolExecuteFunction, ToolContext } from '../../types/tools.js';

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
  const result = await nexo.instagram(url);

  if (result.data?.url && result.data.url.length > 0) {
    const mediaUrl = result.data.url[0];
    const isVideo = result.data.isVideo;

    if (context.socket && context.fromJid) {
      if (isVideo) {
        await context.socket.sendMessage(context.fromJid, {
          video: { url: mediaUrl },
          caption: `📸 Instagram Video\n\n_Downloaded via AI_`,
        });
      } else {
        await context.socket.sendMessage(context.fromJid, {
          image: { url: mediaUrl },
          caption: `📸 Instagram Photo\n\n_Downloaded via AI_`,
        });
      }
    }

    return {
      success: true,
      message: `Berhasil mendownload ${isVideo ? 'video' : 'foto'} dari Instagram. Media sudah dikirim ke user.`,
      data: { type: isVideo ? 'video' : 'image', url: mediaUrl },
    };
  }

  return {
    success: false,
    message: 'Gagal mengambil media dari Instagram. Link mungkin tidak valid, privat, atau media tidak ditemukan.',
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
      message: 'Berhasil mendownload video dari Facebook. Media sudah dikirim ke user.',
      data: { type: 'video', url: mediaUrl },
    };
  }

  return {
    success: false,
    message: 'Gagal mengambil video dari Facebook. Link mungkin tidak valid, privat, atau video tidak ditemukan.',
  };
}

// ─── Twitter / X ─────────────────────────────────────────────────────────────

async function handleTwitter(url: string, context: ToolContext) {
  const result = await nexo.twitter(url);

  if (result.data?.result && result.data.result.length > 0) {
    const mediaUrl = result.data.result[0].url;

    if (context.socket && context.fromJid) {
      await context.socket.sendMessage(context.fromJid, {
        video: { url: mediaUrl },
        caption: `🐦 Twitter/X Video\n\n_Downloaded via AI_`,
      });
    }

    return {
      success: true,
      message: 'Berhasil mendownload media dari Twitter/X. Media sudah dikirim ke user.',
      data: { type: 'video', url: mediaUrl },
    };
  }

  return {
    success: false,
    message: 'Gagal mengambil media dari Twitter/X. Link mungkin tidak valid atau tweet tidak memiliki media.',
  };
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
        message: `Berhasil mendownload ${data.images.length} foto dari TikTok. Media sudah dikirim ke user.`,
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
    return { success: false, message: 'URL tidak diberikan.' };
  }

  const platform = detectPlatform(url);
  if (!platform) {
    return {
      success: false,
      message: 'URL tidak dikenali. Pastikan URL berasal dari TikTok, Instagram, Facebook, atau Twitter/X.',
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
