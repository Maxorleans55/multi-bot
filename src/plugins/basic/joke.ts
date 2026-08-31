import type { CommandModule } from '../../types/index.js';

const jokeCmd: CommandModule = {
  config: {
    name: 'joke',
    description: 'Random joke',
    usage: '!joke',
    category: 'basic',
  },
  handler: async function (context, _args: string[]): Promise<void> {
    const jokes = [
      { setup: "Why don't scientists trust atoms?", punchline: 'Because they make up everything!' },
      { setup: 'Why did the scarecrow win an award?', punchline: 'Because he was outstanding in his field!' },
      { setup: 'What do you call a fake noodle?', punchline: 'An impasta!' },
      { setup: "Why don't eggs tell jokes?", punchline: "They'd crack each other up!" },
      { setup: 'What do you call a bear with no teeth?', punchline: 'A gummy bear!' },
    ];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    await context.socket.sendMessage(context.fromJid, {
      text: `😄 *Joke*\n\n${joke.setup}\n\n${joke.punchline}`,
    });
  },
};

export default jokeCmd;
