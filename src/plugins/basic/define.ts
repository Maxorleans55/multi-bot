import type { CommandModule } from '../../types/index.js';
import axios from 'axios';

const defineCmd: CommandModule = {
  config: {
    name: 'define',
    description: 'Define a word',
    usage: '!define <word>',
    category: 'basic',
  },
  handler: async function (context, args: string[]): Promise<void> {
    const word = args[0];
    if (!word) {
      await context.socket.sendMessage(context.fromJid, { text: 'Usage: !define <word>' });
      return;
    }
    try {
      const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      const data = response.data[0];
      const meaning = data.meanings[0];
      const definition = meaning.definitions[0].definition;
      const example = meaning.definitions[0].example || 'No example';
      await context.socket.sendMessage(context.fromJid, {
        text: `📖 *${data.word}*\n\n📝 ${definition}\n\n💬 Example: ${example}\n\n🔊 ${data.phonetics[0]?.text || ''}`,
      });
    } catch {
      await context.socket.sendMessage(context.fromJid, {
        text: `❌ Could not find definition for "${word}"`,
      });
    }
  },
};

export default defineCmd;
