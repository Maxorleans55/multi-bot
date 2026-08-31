import type { CommandModule } from '../../types/index.js';

const welcomeCmd: CommandModule = {
  config: {
    name: 'welcome',
    description: 'Toggle welcome messages (owner only)',
    usage: '!welcome',
    category: 'group',
    ownerOnly: true,
    groupOnly: true,
  },
  handler: async function (context, _args: string[]): Promise<void> {
    const chatId = context.fromJid;
    const key = `welcome_${chatId}`;
    const current = (global as any)[key] || false;
    (global as any)[key] = !current;
    const status = (global as any)[key] ? '✅ ON' : '❌ OFF';
    await context.socket.sendMessage(chatId, {
      text: `👋 *Welcome Message:* ${status}\n\nWhen ON, new members get a welcome message.`,
    });
  },
};

export function isWelcomeEnabled(chatId: string): boolean {
  return !!(global as any)[`welcome_${chatId}`];
}

export default welcomeCmd;
