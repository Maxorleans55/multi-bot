import type { AIToolDefinition, ToolExecuteFunction } from '../../types/tools.js';

/**
 * YouTube tool definition.
 * Downloads YouTube video/audio and sends directly to the WhatsApp user.
 * Supports sending as document for files up to 2GB.
 */
export const definition: AIToolDefinition = {
  type: 'function',
  function: {
    name: 'download_youtube',
    description: 'Download media from YouTube. Requires a valid YouTube URL. Supports video and audio formats. Can send as document for larger file size limit (up to 2GB).',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The full YouTube URL (e.g. https://youtube.com/watch?v=xxx or https://youtu.be/xxx)',
        },
        format: {
          type: 'string',
          description: 'Download format. "video" for mp4, "audio" for mp3. Default: "video".',
          enum: ['video', 'audio'],
        },
        quality: {
          type: 'string',
          description: 'Video quality. "best", "720p", "360p". Default: "best".',
          enum: ['best', '720p', '360p'],
        },
        as_document: {
          type: 'boolean',
          description: 'Send as document instead of video/audio. Allows files up to 2GB (WhatsApp document limit). Default: false.',
        },
      },
      required: ['url'],
    },
  },
};

export const execute: ToolExecuteFunction = async (args, context) => {
  const url = args.url as string;
  if (!url) {
    return { success: false, message: 'URL YouTube tidak diberikan.' };
  }

  const format = (args.format as string) || 'video';
  const quality = (args.quality as string) || 'best';
  const asDocument = args.as_document === true;

  try {
    const { youtubeDl } = await import('youtube-dl-exec');
    const tempDir = (await import('path')).join(process.cwd(), 'temp');
    const fs = await import('fs/promises');

    await fs.mkdir(tempDir, { recursive: true });

    // Get video info first
    const info = await youtubeDl(url, {
      noWarnings: true,
      callHome: false,
      noCheckCertificates: true,
      preferFreeFormats: true,
      dumpJson: true,
    }, { cwd: tempDir }) as any;

    if (!info || !info.title) {
      return { success: false, message: 'Gagal mendapatkan info video YouTube. URL mungkin tidak valid.' };
    }

    const title = info.title || 'Unknown';
    const uploader = info.uploader || 'Unknown';
    const duration = info.duration || 0;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    // Download
    const downloadFlags: Record<string, any> = {
      noWarnings: true,
      callHome: false,
      noCheckCertificates: true,
      preferFreeFormats: true,
      output: (await import('path')).join(tempDir, `${info.id || 'video'}.%(ext)s`),
    };

    if (format === 'audio') {
      downloadFlags.extractAudio = true;
      downloadFlags.audioFormat = 'mp3';
      downloadFlags.audioQuality = 0;
    } else {
      if (quality === 'best') {
        downloadFlags.format = 'bestvideo+bestaudio/best';
      } else {
        downloadFlags.format = `bestvideo[height<=${quality.replace('p', '')}]+bestaudio/best[height<=${quality.replace('p', '')}]`;
      }
      downloadFlags.mergeOutputFormat = 'mp4';
    }

    await youtubeDl(url, downloadFlags, { cwd: tempDir });

    const ext = format === 'audio' ? 'mp3' : 'mp4';
    const filePath = (await import('path')).join(tempDir, `${info.id || 'video'}.${ext}`);
    const stats = await fs.stat(filePath);

    // Document mode: 2GB limit, regular mode: 50MB limit (WhatsApp media cap)
    const sizeLimit = asDocument ? 2000 * 1024 * 1024 : 50 * 1024 * 1024;
    if (stats.size > sizeLimit) {
      await fs.unlink(filePath);
      const limitMb = asDocument ? 2000 : 50;
      return {
        success: false,
        message: `File terlalu besar (${(stats.size / 1024 / 1024).toFixed(2)}MB). WhatsApp memiliki batas ${limitMb}MB.`,
        data: { title, uploader, duration: durationStr, fileSize: stats.size },
      };
    }

    if (context.socket && context.fromJid) {
      const caption = `🎥 YouTube ${format === 'audio' ? 'Audio' : 'Video'}\n\n` +
        `📌 ${title}\n` +
        `👤 ${uploader}\n` +
        `⏱️ ${durationStr}\n` +
        `🎚️ ${quality}\n` +
        `📦 ${(stats.size / 1024 / 1024).toFixed(2)}MB\n\n` +
        `_Downloaded via AI_`;

      if (asDocument) {
        // Send as document for files up to 2GB
        await context.socket.sendMessage(context.fromJid, {
          document: { url: filePath },
          mimetype: format === 'audio' ? 'audio/mpeg' : 'video/mp4',
          fileName: `${title}.${ext}`,
          caption,
        });
      } else if (format === 'audio') {
        await context.socket.sendMessage(context.fromJid, {
          audio: { url: filePath },
          mimetype: 'audio/mpeg',
        });
      } else {
        await context.socket.sendMessage(context.fromJid, {
          video: { url: filePath },
          caption,
          mimetype: 'video/mp4',
        });
      }

      // Clean up after 30s
      setTimeout(async () => {
        try { await fs.unlink(filePath); } catch {}
      }, 30000);
    }

    return {
      success: true,
      message: `Berhasil mendownload ${format === 'audio' ? 'audio' : 'video'} YouTube "${title}". Media sudah dikirim ke user.`,
      data: { title, uploader, duration: durationStr, format, quality, fileSize: stats.size, asDocument },
    };
  } catch (error: any) {
    console.error('[Tool:YouTube] Download error:', error);
    let errorMessage = 'Gagal mendownload dari YouTube.';

    if (error?.stderr) {
      const stderr = error.stderr as string;
      if (stderr.includes('Video unavailable')) errorMessage = 'Video tidak tersedia atau telah dihapus.';
      else if (stderr.includes('Private video')) errorMessage = 'Video ini bersifat privat.';
      else if (stderr.includes('not available')) errorMessage = 'Video tidak tersedia di wilayah ini.';
    }

    return {
      success: false,
      message: errorMessage,
    };
  }
};
