import type { AIToolDefinition, ToolExecuteFunction } from '../../types/tools.js';

export const definition: AIToolDefinition = {
  type: 'function',
  function: {
    name: 'pinterest_search',
    description: 'Search for images on Pinterest. Returns images based on a search query.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search term to find images on Pinterest (e.g. "wallpaper anime", "kucing lucu")',
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

  try {
    const pinterest = (await import('../../utils/pinterest.js')).default;
    const results = await pinterest(query);

    if (results.length === 0) {
      return {
        success: false,
        message: `Tidak ditemukan hasil untuk pencarian "${query}" di Pinterest.`,
      };
    }

    // Take random image from results
    const randomIndex = Math.floor(Math.random() * results.length);
    const imageUrl = results[randomIndex];

    if (context.socket && context.fromJid) {
      await context.socket.sendMessage(context.fromJid, {
        image: { url: imageUrl },
        caption: `📌 *Pinterest*\n\nQuery: ${query}\n\n_Downloaded via AI_`,
      });
    }

    return {
      success: true,
      message: `Berhasil mencari gambar "${query}" di Pinterest. Ditemukan ${results.length} hasil. Media sudah dikirim ke user.`,
      data: { query, totalResults: results.length, imageUrl },
    };
  } catch (error: any) {
    console.error('[Tool:Pinterest] Search error:', error);
    return {
      success: false,
      message: `Gagal mencari gambar di Pinterest: ${error.message || 'Unknown error'}`,
    };
  }
};
