import type { CommandModule } from '../../types/index.js';

const antilinkCmd: CommandModule = {
  config: {
    name: 'antilink',
    description: 'Toggle antilink (owner only)',
    usage: '!antilink',
    category: 'group',
    ownerOnly: true,
    groupOnly: true,
  },
  handler: async function (context, _args: string[]): Promise<void> {
    const chatId = context.fromJid;
    // Toggle antilink state (in-memory for now)
    const key = `antilink_${chatId}`;
    const current = (global as any)[key] || false;
    (global as any)[key] = !current;
    const status = (global as any)[key] ? '✅ ON' : '❌ OFF';
    await context.socket.sendMessage(chatId, {
      text: `🔗 *Antilink:* ${status}\n\nWhen ON, links from non-admins will be deleted.`,
    });
  },
};

export function isAntilinkEnabled(chatId: string): boolean {
  return !!(global as any)[`antilink_${chatId}`];
}

export default antilinkCmd;
