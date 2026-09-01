import { randomInt } from 'crypto';
import { Sticker } from 'wa-sticker-formatter';
import pinterest from '../../utils/pinterest.js';
import type { CommandModule } from '../../types/index.js';

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

function parseCount(args: string[]): number {
  // Check for -count=N or --count=N pattern
  for (const arg of args) {
    const countMatch = arg.match(/^-{1,2}count=(\d+)$/i);
    if (countMatch) {
      const c = parseInt(countMatch[1], 10);
      return Math.min(Math.max(c, 1), 10);
    }
  }
  return 1;
}

const pinterestCommand: CommandModule = {
  config: {
    name: 'pinterest',
    aliases: ['pin'],
    description: 'Search images on Pinterest. Can request multiple images: !pinterest <query> -count=5',
    usage: '!pinterest <query> [-sticker] [-count=N]',
    category: 'media',
  },
  handler: async function (context, args: string[]): Promise<void> {
    if (args.length === 0) {
      await context.socket.sendMessage(context.fromJid, {
        text: '❌ Please provide a search query. Usage: !pinterest <query> [-sticker] [-count=N]',
      });
      return;
    }

    const count = parseCount(args);
    const cleanArgs = args.filter((a) => !/^-{1,2}count=\d+$/i.test(a));
    const query = cleanArgs.join(' ').replace('-sticker', '').trim();
    const isSticker = cleanArgs.includes('-sticker');

    await context.socket.sendMessage(context.fromJid, {
      text: `⏳ Searching for ${count} images of "${query}" on Pinterest...`,
    });

    try {
      const results = shuffleArray(await pinterest(query));

      if (results.length === 0) {
        await context.socket.sendMessage(context.fromJid, {
          text: `❌ No results found for "${query}"`,
        });
        return;
      }

      const sendCount = Math.min(count, results.length);

      if (isSticker) {
        await context.socket.sendMessage(context.fromJid, {
          text: `⏳ Creating ${sendCount} stickers...`,
        });

        let successCount = 0;
        for (let i = 0; i < sendCount; i++) {
          try {
            const sticker = new Sticker(results[i], {
              pack: 'Bot-Baileys-AI',
              author: 'Pinterest',
              type: 'full',
              quality: 100,
            });

            const stickerBuffer = await sticker.toBuffer();

            await context.socket.sendMessage(context.fromJid, {
              sticker: stickerBuffer,
            });
            successCount++;
          } catch (stickerError) {
            console.error(`Error creating sticker ${i + 1}:`, stickerError);
          }
        }

        if (successCount === 0) {
          await context.socket.sendMessage(context.fromJid, {
            text: '❌ Gagal membuat sticker dari gambar Pinterest.',
          });
        }
      } else {
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
            console.error(`Error sending image ${i + 1}:`, sendError);
          }
        }

        if (sentCount === 0) {
          await context.socket.sendMessage(context.fromJid, {
            text: '❌ Gagal mengirim gambar Pinterest.',
          });
        }
      }
    } catch (error) {
      console.error('Error searching Pinterest:', error);
      await context.socket.sendMessage(context.fromJid, {
        text: '❌ Terjadi kesalahan saat mencari gambar di Pinterest. Silahkan coba lagi nanti.',
      });
    }
  },
};

export default pinterestCommand;
