import type { CommandModule } from '../../types/index.js';

const statusinfoCmd: CommandModule = {
  config: {
    name: 'statusinfo',
    description: 'Check your status settings',
    usage: '!statusinfo',
    category: 'general',
  },
  handler: async function (context, _args: string[]): Promise<void> {
    const sender = context.simplified?.user_id || context.fromJid;
    const watchKey = `autowatch_${sender}`;
    const likeKey = `autolike_${sender}`;
    const watchStatus = (global as any)[watchKey] ? 'ON' : 'OFF';
    const likeStatus = (global as any)[likeKey] ? 'ON' : 'OFF';
    await context.socket.sendMessage(context.fromJid, {
      text: `📱 *Your Status Settings*\n\n👁️ Auto Watch: ${watchStatus}\n❤️ Auto Like: ${likeStatus}\n\nUse !autowatch or !autolike to toggle.`,
    });
  },
};

export default statusinfoCmd;
