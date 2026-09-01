import type { CommandModule } from '../../types/index.js';

const calcCmd: CommandModule = {
  config: {
    name: 'calc',
    description: 'Calculator',
    usage: '!calc <expression>',
    category: 'tools',
  },
  handler: async function (context, args: string[]): Promise<void> {
    const expression = args.join(' ');
    if (!expression) {
      await context.socket.sendMessage(context.fromJid, {
        text: 'Usage: !calc <expression>\nExample: !calc 2+2*3',
      });
      return;
    }
    try {
      const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
      // eslint-disable-next-line no-eval
      const result = Function('"use strict";return (' + sanitized + ')')();
      await context.socket.sendMessage(context.fromJid, {
        text: `🔢 *Calculator*\n\nExpression: ${expression}\nResult: ${result}`,
      });
    } catch {
      await context.socket.sendMessage(context.fromJid, { text: '❌ Invalid math expression.' });
    }
  },
};

export default calcCmd;
