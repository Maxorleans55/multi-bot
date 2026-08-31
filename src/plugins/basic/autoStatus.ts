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
    const status = (global as any)[key] ? '✅ ON' : '❌ OFF';
    await context.socket.sendMessage(context.fromJid, {
      text: `👁️ *Auto Watch Status:* ${status}\n\nWhen ON, bot will automatically view all status updates.`,
    });
  },
};

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
    const status = (global as any)[key] ? '✅ ON' : '❌ OFF';
    await context.socket.sendMessage(context.fromJid, {
      text: `❤️ *Auto Like Status:* ${status}\n\nWhen ON, bot will automatically like all status updates.`,
    });
  },
};

const statusinfoCmd: CommandModule = {
  config: {
    name: 'statusinfo',
    description: 'Check your status settings',
    usage: '!statusinfo',
    category: 'basic',
  },
  handler: async function (context, _args: string[]): Promise<void> {
    const sender = context.simplified?.user_id || context.fromJid;
    const watchKey = `autowatch_${sender}`;
    const likeKey = `autolike_${sender}`;
    const watchStatus = (global as any)[watchKey] ? '✅ ON' : '❌ OFF';
    const likeStatus = (global as any)[likeKey] ? '✅ ON' : '❌ OFF';
    await context.socket.sendMessage(context.fromJid, {
      text: `📱 *Your Status Settings*\n\n👁️ Auto Watch: ${watchStatus}\n❤️ Auto Like: ${likeStatus}\n\nUse !autowatch or !autolike to toggle.`,
    });
  },
};

export function isAutoWatchEnabled(userId: string): boolean {
  return !!(global as any)[`autowatch_${userId}`];
}

export function isAutoLikeEnabled(userId: string): boolean {
  return !!(global as any)[`autolike_${userId}`];
}

export default [autowatchCmd, autolikeCmd, statusinfoCmd];
