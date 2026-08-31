import type { CommandModule } from '../../types/index.js';
import axios from 'axios';

const weatherCmd: CommandModule = {
  config: {
    name: 'weather',
    description: 'Get weather info',
    usage: '!weather <city>',
    category: 'basic',
  },
  handler: async function (context, args: string[]): Promise<void> {
    const city = args.join(' ');
    if (!city) {
      await context.socket.sendMessage(context.fromJid, {
        text: 'Usage: !weather <city>\nExample: !weather London',
      });
      return;
    }
    try {
      const response = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=4`);
      await context.socket.sendMessage(context.fromJid, {
        text: `🌤️ *Weather*\n\n${response.data}`,
      });
    } catch {
      await context.socket.sendMessage(context.fromJid, {
        text: `❌ Could not get weather for "${city}"`,
      });
    }
  },
};

export default weatherCmd;
