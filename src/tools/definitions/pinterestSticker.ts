import type { AIToolDefinition, ToolExecuteFunction } from '../../types/tools.js';
import { createPinterestSticker, type PinterestStickerType } from '../../utils/pinterestSticker.js';

function parseIndex(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(Math.floor(parsed), 50);
}

function parseStickerType(value: unknown): PinterestStickerType {
  if (value === 'default' || value === 'cropped' || value === 'full') {
    return value;
  }
  return 'full';
}

export const definition: AIToolDefinition = {
  type: 'function',
  function: {
    name: 'pinterest_sticker',
    description:
      'Create and send a WhatsApp sticker from a Pinterest URL or a plain search keyword using gallery-dl on Pinterest. Use this when the user asks to make a sticker/stiker from Pinterest or when the user gives a Pinterest URL or a topic/keyword like "kucing".',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Optional Pinterest URL (pin, board, or user page) to download images from.',
        },
        query: {
          type: 'string',
          description: 'Optional plain search keyword/topic when the user does not provide a URL, e.g. "kucing", "anime lucu", or "meme tidur".',
        },
        pack: {
          type: 'string',
          description: 'Optional sticker pack name. Default: Bot-Baileys-AI.',
        },
        author: {
          type: 'string',
          description: 'Optional sticker author name. Default: Pinterest.',
        },
        sticker_type: {
          type: 'string',
          enum: ['full', 'cropped', 'default'],
          description: 'Sticker layout. Use full by default, cropped for square crop, or default for library default.',
        },
        index: {
          type: 'number',
          description: 'Optional 1-based item number from the Pinterest gallery to use. Default is 1. Maximum is 50.',
        },
      },
      required: [],
    },
  },
};

export const execute: ToolExecuteFunction = async (args, context) => {
  const url = typeof args.url === 'string' ? args.url.trim() : '';
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  if (!url && !query) {
    return { success: false, message: 'URL Pinterest atau kata kunci tidak diberikan.' };
  }

  if (!context.socket || !context.fromJid) {
    return {
      success: false,
      message: 'Konteks chat tidak tersedia, jadi sticker tidak bisa dikirim.',
    };
  }

  try {
    const result = await createPinterestSticker({
      url: url || undefined,
      query: query || undefined,
      packName: typeof args.pack === 'string' ? args.pack : undefined,
      authorName: typeof args.author === 'string' ? args.author : undefined,
      stickerType: parseStickerType(args.sticker_type),
      index: parseIndex(args.index),
    });

    await context.socket.sendMessage(context.fromJid, {
      sticker: result.stickerBuffer,
    });

    return {
      success: true,
      message: 'Sticker dari Pinterest berhasil dibuat dan sudah dikirim ke user.',
      data: {
        sourceFileName: result.sourceFileName,
        downloadedFiles: result.downloadedFiles,
      },
    };
  } catch (error: any) {
    console.error('[Tool:pinterest_sticker] Error:', error);
    return {
      success: false,
      message: `Gagal membuat sticker dari Pinterest: ${error.message || 'Unknown error'}`,
    };
  }
};
