import type { CommandModule } from '../../types/index.js';

const autowatchCmd: CommandModule = {
  config: {
    name: 'autowatch',
    description: 'Toggle auto view status updates',
    usage: '!autowatch',
    category: 'basic',
  },
  handler: async function (context, _args: string[]): Promise<void> {
    const sender = context.simplified?.user_id || context.fromJid;
    const key = `autowatch_${sender}`;
    const current = (global as any)[key] || false;
    (global as any)[key] = !current;
    const status = (global as any)[key] ? 'ON' : 'OFF';
    await context.socket.sendMessage(context.fromJid, {
      text: `👁️ *Auto Watch Status:* ${status}\n\nWhen ON, bot will automatically view all status updates.`,
    });
  },
};

export default autowatchCmd;
