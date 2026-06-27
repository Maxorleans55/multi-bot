import { randomInt } from 'crypto';
import type { AIToolDefinition, ToolExecuteFunction } from '../../types/tools.js';
import pinterest from '../../utils/pinterest.js';

/**
 * Fisher-Yates shuffle to randomize array order in-place.
 */
function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const definition: AIToolDefinition = {
  type: 'function',
  function: {
    name: 'pinterest_search',
    description: 'Search for images on Pinterest. Returns 1 or more images based on a search query. Use "count" to request multiple images at once (e.g. 5 gambar).',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search term to find images on Pinterest (e.g. "wallpaper anime", "kucing lucu")',
        },
        count: {
          type: 'number',
          description: 'Number of images to return. Default 1. Maximum 10. Use this when user asks for multiple images like "5 gambar kucing"',
        },
      },
      required: ['query'],
    },
  },
};

export const execute: ToolExecuteFunction = async (args, context) => {
  const query = args.query as string;
  if (!query) {
    return { success: false, message: 'Query pencarian Pinterest tidak diberikan.' };
  }

  const count = typeof args.count === 'number' && args.count > 0
    ? Math.min(Math.floor(args.count), 10)
    : 1;

  try {
    // pinterest() already shuffles, but shuffle again locally for extra randomness
    const results = shuffleArray(await pinterest(query));

    if (results.length === 0) {
      return {
        success: false,
        message: `Tidak ditemukan hasil untuk pencarian "${query}" di Pinterest.`,
      };
    }

    if (!context.socket || !context.fromJid) {
      return {
        success: true,
        message: `Berhasil mencari gambar "${query}" di Pinterest. Ditemukan ${results.length} hasil.`,
        data: { query, totalResults: results.length, imageUrls: results.slice(0, count) },
      };
    }

    // Send the requested number of images
    const sendCount = Math.min(count, results.length);
    let sentCount = 0;

    for (let i = 0; i < sendCount; i++) {
      try {
        await context.socket.sendMessage(context.fromJid, {
          image: { url: results[i] },
          caption: i === 0
            ? `📌 *Pinterest*\n\nQuery: ${query}\n\n_Gambar ${i + 1} dari ${sendCount}_`
            : undefined,
        });
        sentCount++;
      } catch (sendError) {
        console.error(`[Tool:Pinterest] Gagal kirim gambar ${i + 1}:`, sendError);
      }
    }

    return {
      success: true,
      message: `Berhasil mencari ${sentCount} gambar "${query}" di Pinterest. Ditemukan ${results.length} hasil. Media sudah dikirim ke user.`,
      data: { query, totalResults: results.length, sentCount, urlsReturned: results.slice(0, sendCount) },
    };
  } catch (error: any) {
    console.error('[Tool:Pinterest] Search error:', error);
    return {
      success: false,
      message: `Gagal mencari gambar di Pinterest: ${error.message || 'Unknown error'}`,
    };
  }
};
