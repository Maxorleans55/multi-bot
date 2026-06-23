import type { CommandModule, CommandContext } from '../../types/index.js';
import {
  getTwitterInfo,
  downloadTwitterMedia,
  buildTwitterCaption,
  parseTwitterError,
  isValidTwitterUrl,
  detectFileType,
  scheduleFileCleanup,
} from '../../utils/twitterDownloader.js';

const twitterCommand: CommandModule = {
  config: {
    name: 'twitter',
    aliases: ['x', 'tw', 'twdl', 'xdl'],
    description: 'Download media (video/image) dari Twitter/X',
    usage: '!twitter <twitter/x-url>\n!x <twitter/x-url>\nExample: !twitter https://twitter.com/user/status/123456\nExample: !x https://x.com/user/status/123456',
    category: 'media',
  },
  handler: async function (context: CommandContext, args: string[]): Promise<void> {
    const url = args[0];

    if (!url) {
      await context.socket.sendMessage(context.fromJid, {
        text: '❌ Please provide a Twitter/X URL.\n\nUsage: !twitter <twitter/x-url>\n       !x <twitter/x-url>\n\nExample: !twitter https://twitter.com/user/status/123456\nExample: !x https://x.com/user/status/123456',
      });
      return;
    }

    if (!isValidTwitterUrl(url)) {
      await context.socket.sendMessage(context.fromJid, {
        text: '❌ URL tidak valid. Harus berupa link tweet Twitter/X.\n\nContoh:\n- https://twitter.com/user/status/123456\n- https://x.com/user/status/123456',
      });
      return;
    }

    await context.socket.sendMessage(context.fromJid, {
      text: `🐦 Mendownload media dari Twitter/X...`,
    });

    try {
      // Step 1: Get tweet info
      const info = await getTwitterInfo(url);

      if (!info || !info.title) {
        await context.socket.sendMessage(context.fromJid, {
          text: '❌ Gagal mendapatkan informasi tweet. URL mungkin tidak valid.',
        });
        return;
      }

      // Step 2: Download media
      const result = await downloadTwitterMedia(url, info);

      if (!result.success || !result.filePath) {
        // If no media, show tweet info
        if (result.error?.includes('Tidak ada media')) {
          await context.socket.sendMessage(context.fromJid, {
            text: `📝 *Tweet Info*\n\n👤 ${info.uploader || 'Unknown'} (@${info.uploader_id || 'unknown'})\n📄 ${info.title || ''}\n\n❌ Tidak ada media yang dapat diunduh dari tweet ini.`,
          });
        } else {
          await context.socket.sendMessage(context.fromJid, {
            text: `❌ ${result.error}`,
          });
        }
        return;
      }

      // Step 3: Send media to user
      const caption = buildTwitterCaption(
        result.info || info,
        result.fileSize || 0,
        info.duration,
        undefined // no suffix for manual command
      );

      const fileType = result.fileType || detectFileType(result.fileExt || '');

      switch (fileType) {
        case 'image':
          await context.socket.sendMessage(context.fromJid, { image: { url: result.filePath }, caption });
          break;
        case 'video':
          await context.socket.sendMessage(context.fromJid, { video: { url: result.filePath }, caption, mimetype: 'video/mp4' });
          break;
        case 'audio':
          await context.socket.sendMessage(context.fromJid, { audio: { url: result.filePath }, mimetype: 'audio/mpeg' });
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

      // Step 4: Cleanup
      scheduleFileCleanup(result.filePath);
    } catch (error: any) {
      console.error('Twitter/X download error:', error);
      const errorMessage = parseTwitterError(error);
      await context.socket.sendMessage(context.fromJid, {
        text: `❌ ${errorMessage}\n\nPastikan URL benar dan tweet memiliki media.\nBila masalah berlanjut, silahkan hubungi Owner.`,
      });
    }
  },
};

export default twitterCommand;
