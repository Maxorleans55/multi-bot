import type { CommandModule } from '../../types/index.js';

const quoteCmd: CommandModule = {
  config: {
    name: 'quote',
    description: 'Random quote',
    usage: '!quote',
    category: 'tools',
  },
  handler: async function (context, _args: string[]): Promise<void> {
    const quotes = [
      { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
      { text: 'Innovation distinguishes between a leader and a follower.', author: 'Steve Jobs' },
      { text: 'Life is what happens when you are busy making other plans.', author: 'John Lennon' },
      { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
      { text: 'It is during our darkest moments that we must focus to see the light.', author: 'Aristotle' },
    ];
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    await context.socket.sendMessage(context.fromJid, {
      text: `💫 *Quote*\n\n"${quote.text}"\n\n— ${quote.author}`,
    });
  },
};

export default quoteCmd;
