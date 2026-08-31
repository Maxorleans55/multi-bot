import type { CommandModule } from '../../types/index.js';

const autolikeCmd: CommandModule = {
  config: {
    name: 'autolike',
    description: 'Toggle auto react to status updates',
    usage: '!autolike',
    category: 'basic',
  },
  handler: async function (context, _args: string[]): Promise<void> {
    const sender = context.simplified?.user_id || context.fromJid;
    const key = `autolike_${sender}`;
    const current = (global as any)[key] || false;
    (global as any)[key] = !current;
    const status = (global as any)[key] ? 'ON' : 'OFF';
    await context.socket.sendMessage(context.fromJid, {
      text: `❤️ *Auto Like Status:* ${status}\n\nWhen ON, bot will automatically like all status updates.`,
    });
  },
};

export default autolikeCmd;
