import type { CommandModule } from '../../types/index.js';
import axios from 'axios';

const translateCmd: CommandModule = {
  config: {
    name: 'translate',
    aliases: ['tr'],
    description: 'Translate text to another language',
    usage: '!translate <lang> <text>',
    category: 'tools',
  },
  handler: async function (context, args: string[]): Promise<void> {
    const lang = args[0];
    const text = args.slice(1).join(' ');
    if (!lang || !text) {
      await context.socket.sendMessage(context.fromJid, {
        text: 'Usage: !translate <lang> <text>\nExample: !translate es hello world',
      });
      return;
    }
    try {
      const response = await axios.get(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`
      );
      const translated = response.data.responseData.translatedText;
      await context.socket.sendMessage(context.fromJid, {
        text: `🌐 *Translation*\n\nOriginal: ${text}\nTranslated (${lang}): ${translated}`,
      });
    } catch {
      await context.socket.sendMessage(context.fromJid, { text: '❌ Translation failed.' });
    }
  },
};

export default translateCmd;
