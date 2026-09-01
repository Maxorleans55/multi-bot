import type { CommandModule } from '../../types/index.js';

const reverseCmd: CommandModule = {
  config: {
    name: 'reverse',
    description: 'Reverse text',
    usage: '!reverse <text>',
    category: 'tools',
  },
  handler: async function (context, args: string[]): Promise<void> {
    const text = args.join(' ');
    if (!text) {
      await context.socket.sendMessage(context.fromJid, { text: 'Usage: !reverse <text>' });
      return;
    }
    await context.socket.sendMessage(context.fromJid, { text: `🔄 *Reversed:* ${text.split('').reverse().join('')}` });
  },
};

export default reverseCmd;
