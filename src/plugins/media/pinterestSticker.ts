import type { CommandModule } from '../../types/index.js';
import { createPinterestSticker, type PinterestStickerType } from '../../utils/pinterestSticker.js';

interface ParsedArgs {
  url?: string;
  query?: string;
  packName?: string;
  authorName?: string;
  stickerType: PinterestStickerType;
  index: number;
}

function parseIndex(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(Math.floor(parsed), 50);
}

const PINTEREST_URL_PATTERN = /^https?:\/\/([a-z0-9-]+\.)?(pinterest\.[a-z.]+|pin\.it)\//i;

function isPinterestUrl(input: string): boolean {
  return PINTEREST_URL_PATTERN.test(input);
}

function parseArgs(args: string[]): ParsedArgs | null {
  const positionalParts: string[] = [];
  let stickerType: PinterestStickerType = 'full';
  let index = 1;
  let packName: string | undefined;
  let authorName: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    const lower = token.toLowerCase();

    if (lower === '-full' || lower === '--full') {
      stickerType = 'full';
      continue;
    }
    if (lower === '-cropped' || lower === '--cropped') {
      stickerType = 'cropped';
      continue;
    }
    if (lower === '-default' || lower === '--default') {
      stickerType = 'default';
      continue;
    }
    if (lower === '-i' || lower === '--index') {
      index = parseIndex(args[i + 1]);
      i += 1;
      continue;
    }
    if (lower === '--pack') {
      packName = args[i + 1]?.trim() || undefined;
      i += 1;
      continue;
    }
    if (lower === '--author') {
      authorName = args[i + 1]?.trim() || undefined;
      i += 1;
      continue;
    }

    positionalParts.push(token);
  }

  if (positionalParts.length === 0) return null;

  const first = positionalParts[0];
  if (!isPinterestUrl(first)) {
    return {
      query: positionalParts.join(' ').trim(),
      packName,
      authorName,
      stickerType,
      index,
    };
  }

  const nameArg = positionalParts.slice(1).join(' ').trim();

  if (nameArg.includes('|')) {
    const [pack, author] = nameArg.split('|');
    packName = pack.trim() || undefined;
    authorName = author.trim() || undefined;
  } else if (nameArg) {
    packName = nameArg;
  }

  return { url: first, packName, authorName, stickerType, index };
}

const pinterestStickerCommand: CommandModule = {
  config: {
    name: 'pinsticker',
    aliases: ['pinstiker', 'pintereststicker', 'pintereststiker'],
    description: 'Create sticker from Pinterest URL or search keyword',
    usage: '!pinsticker <url/keyword> [pack|author] [-full|-cropped|-default] [-i number] [--pack name] [--author name]',
    category: 'media',
  },
  handler: async function (context, args: string[]): Promise<void> {
    const parsed = parseArgs(args);
    if (!parsed) {
      await context.socket.sendMessage(context.fromJid, {
        text: '❌ Please provide a Pinterest URL or keyword.\nUsage: !pinsticker <url/keyword> [-full|-cropped|-default] [-i number]',
      });
      return;
    }

    await context.socket.sendMessage(context.fromJid, {
      text: parsed.query
        ? `⏳ Searching for "${parsed.query}" on Pinterest and creating sticker...`
        : '⏳ Fetching image from Pinterest and creating sticker...',
    });

    try {
      const result = await createPinterestSticker({
        url: parsed.url,
        query: parsed.query,
        packName: parsed.packName,
        authorName: parsed.authorName,
        stickerType: parsed.stickerType,
        index: parsed.index,
      });

      await context.socket.sendMessage(context.fromJid, {
        sticker: result.stickerBuffer,
      });
    } catch (error: any) {
      console.error('[Command:pinsticker] Error:', error);
      await context.socket.sendMessage(context.fromJid, {
        text: `❌ Gagal membuat sticker dari Pinterest: ${error.message || 'Unknown error'}`,
      });
    }
  },
};

export default pinterestStickerCommand;
