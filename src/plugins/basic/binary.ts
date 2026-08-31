import type { CommandModule } from '../../types/index.js';

const binaryCmd: CommandModule = {
  config: {
    name: 'binary',
    description: 'Convert text to binary',
    usage: '!binary <text>',
    category: 'basic',
  },
  handler: async function (context, args: string[]): Promise<void> {
    const text = args.join(' ');
    if (!text) {
      await context.socket.sendMessage(context.fromJid, { text: 'Usage: !binary <text>' });
      return;
    }
    const binary = text.split('').map((c) => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
    await context.socket.sendMessage(context.fromJid, { text: `🔢 *Binary:* ${binary}` });
  },
};

export default binaryCmd;
