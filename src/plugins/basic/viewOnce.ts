import type { CommandModule } from '../../types/index.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEW_ONCE_DIR = path.join(__dirname, '../../../view_once_media');

if (!fs.existsSync(VIEW_ONCE_DIR)) {
  fs.mkdirSync(VIEW_ONCE_DIR, { recursive: true });
}

const viewOnceStorage = new Map<string, { message: any; mediaType: string; timestamp: number }>();

const vvCmd: CommandModule = {
  config: {
    name: 'vv',
    description: 'Save view once media',
    usage: '!vv (reply to a view once message)',
    category: 'basic',
  },
  handler: async function (context, _args: string[]): Promise<void> {
    const chatId = context.fromJid;
    const quotedMsg = context.message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let mediaMsg: any = null;
    let mediaType: string | null = null;

    if (quotedMsg?.imageMessage?.viewOnce || quotedMsg?.imageMessage) {
      const quotedKey = context.message.message?.extendedTextMessage?.contextInfo?.stanzaId;
      mediaMsg = {
        key: { remoteJid: chatId, id: quotedKey, fromMe: false },
        message: quotedMsg,
      };
      mediaType = 'image';
    } else if (quotedMsg?.videoMessage?.viewOnce || quotedMsg?.videoMessage) {
      const quotedKey = context.message.message?.extendedTextMessage?.contextInfo?.stanzaId;
      mediaMsg = {
        key: { remoteJid: chatId, id: quotedKey, fromMe: false },
        message: quotedMsg,
      };
      mediaType = 'video';
    } else {
      const stored = viewOnceStorage.get(chatId);
      if (stored) {
        mediaMsg = stored.message;
        mediaType = stored.mediaType;
      }
    }

    if (!mediaMsg) {
      await context.socket.sendMessage(chatId, {
        text: 'Reply to a view once message with !vv to save it.\n\nOr send a view once first, then reply with !vv',
      });
      return;
    }

    await context.socket.sendMessage(chatId, { text: '⏳ Saving media...' });

    try {
      const buffer = await downloadMediaMessage(mediaMsg, 'buffer', {});
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const extension = mediaType === 'image' ? 'jpg' : 'mp4';
      const filename = `viewonce_${timestamp}.${extension}`;
      const filepath = path.join(VIEW_ONCE_DIR, filename);

      fs.writeFileSync(filepath, buffer as Buffer);

      const caption = `✅ View once ${mediaType} saved!\n📁 File: ${filename}`;

      if (mediaType === 'image') {
        await context.socket.sendMessage(chatId, { image: buffer, caption });
      } else {
        await context.socket.sendMessage(chatId, { video: buffer, caption });
      }
    } catch (e: any) {
      console.error('Save View Once Error:', e);
      await context.socket.sendMessage(chatId, {
        text: '❌ Failed to save media. View once media may have expired.',
      });
    }
  },
};

export function handleViewOnce(msg: any): void {
  try {
    const chatId = msg.key.remoteJid;
    const message = msg.message;

    if (message?.imageMessage?.viewOnce) {
      viewOnceStorage.set(chatId, { message: msg, mediaType: 'image', timestamp: Date.now() });
      return;
    }

    if (message?.videoMessage?.viewOnce) {
      viewOnceStorage.set(chatId, { message: msg, mediaType: 'video', timestamp: Date.now() });
      return;
    }

    const quotedImage = message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const quotedVideo = message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

    if (quotedImage?.viewOnce || quotedVideo?.viewOnce) {
      const quotedMsg = message.extendedTextMessage.contextInfo.quotedMessage;
      const quotedKey = message.extendedTextMessage.contextInfo.stanzaId;
      const reconstructedMsg = {
        key: { remoteJid: chatId, id: quotedKey, fromMe: false },
        message: quotedMsg,
      };
      viewOnceStorage.set(chatId, {
        message: reconstructedMsg,
        mediaType: quotedImage ? 'image' : 'video',
        timestamp: Date.now(),
      });
    }
  } catch (e) {
    console.error('View Once Handler Error:', e);
  }
}

export default vvCmd;
