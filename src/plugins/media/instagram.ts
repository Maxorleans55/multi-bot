import instagramDownload, { cleanupMergedFile } from '../../utils/instagram.js';
import type { CommandModule } from '../../types/index.js';

const instagramCommand: CommandModule = {
  config: {
    name: 'instagram',
    aliases: ['ig', 'insta', 'igdl'],
    description: 'Download media from Instagram',
    usage: '!instagram <instagram-url>',
    category: 'media',
  },
  handler: async function (context, args: string[]): Promise<void> {
    const url = args[0];

    if (!url) {
      await context.socket.sendMessage(context.fromJid, {
        text: '❌ Please provide an Instagram URL. Usage: !instagram <instagram-url>',
      });
      return;
    }

    await context.socket.sendMessage(context.fromJid, {
      text: '⏳ Mohon tunggu sebentar...',
    });

    const result = await instagramDownload(url);
    const processTime = new Date().getTime() - Number(context.simplified?.messageTimeStamp) * 1000;

    if (!result.status || !result.data) {
      await context.socket.sendMessage(context.fromJid, {
        text: `❌ Gagal mengunduh dari Instagram. ${result.message || 'Pastikan URL benar. Bila masalah berlanjut, silahkan hubungi Owner.'}`,
      });
      return;
    }

    const { url: urls, isVideo, caption, mergedFilePath } = result.data;
    const timeSuffix = `\n\n⏱️ Process Time: ${(processTime / 1000).toFixed(2)} seconds`;

    // If this is a DASH video and we have a merged file, send that instead of raw URLs
    if (isVideo && mergedFilePath) {
      const cap = `📸 *Instagram Video*${caption ? `\n\n${caption}` : ''}${timeSuffix}`;
      try {
        await context.socket.sendMessage(context.fromJid, {
          video: { url: mergedFilePath },
          caption: cap,
          mimetype: 'video/mp4',
        });
      } finally {
        // Schedule cleanup after WhatsApp has consumed the file
        setTimeout(() => cleanupMergedFile(mergedFilePath), 60_000);
      }
      return;
    }

    if (isVideo) {
      // Non-DASH video — send raw URLs directly
      for (let i = 0; i < urls.length; i++) {
        const isFirst = i === 0;
        const cap = isFirst
          ? `📸 *Instagram Video*${caption ? `\n\n${caption}` : ''}${timeSuffix}`
          : undefined;

        await context.socket.sendMessage(context.fromJid, {
          video: { url: urls[i] },
          ...(cap ? { caption: cap } : {}),
        });
      }
    } else {
      // Images — first with caption, rest as-is
      for (let i = 0; i < urls.length; i++) {
        const isFirst = i === 0;
        const cap = isFirst
          ? `📸 *Instagram Photo*${caption ? `\n\n${caption}` : ''}${timeSuffix}`
          : undefined;

        await context.socket.sendMessage(context.fromJid, {
          image: { url: urls[i] },
          ...(cap ? { caption: cap } : {}),
        });
      }
    }
  },
};

export default instagramCommand;
