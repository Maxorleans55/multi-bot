import type { CommandModule } from '../../types/index.js';
import { log } from '../../utils/logger.js';

const pingCommand: CommandModule = {
  config: {
    name: 'ping',
    aliases: ['p'],
    description: 'Test bot response',
    usage: '!ping',
    category: 'basic',
  },
  handler: async function (context, args: string[]): Promise<void> {
    const startTime = context.simplified?.timeStampHandler!;

    log.info(`[ping] Sending pong to ${context.fromJid}`);
    try {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      await context.socket.sendMessage(context.fromJid, {
        text: `Pong! 🏓\n\n⏱️ Response time: ${responseTime}ms`,
      });
      log.info(`[ping] Pong sent successfully to ${context.fromJid}`);
    } catch (err) {
      log.error(`[ping] FAILED to send to ${context.fromJid}:`, err as object);
    }
  },
};

export default pingCommand;
