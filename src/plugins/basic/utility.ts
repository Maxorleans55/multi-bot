import type { CommandModule } from '../../types/index.js';
import axios from 'axios';

const translateCmd: CommandModule = {
  config: {
    name: 'translate',
    aliases: ['tr'],
    description: 'Translate text to another language',
    usage: '!translate <lang> <text>',
    category: 'basic',
  },
  handler: async function (context, args: string[]): Promise<void> {
    const lang = args[0];
    const text = args.slice(1).join(' ');
    if (!lang || !text) {
      await context.socket.sendMessage(context.fromJid, {
        text: 'Usage: !translate <lang> <text>\n\nExample: !translate es hello world',
      });
      return;
    }
    try {
      const response = await axios.get(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`
      );
      const translated = response.data.responseData.translatedText;
      await context.socket.sendMessage(context.fromJid, {
        text: `🌐 *Translation*\n\nOriginal: ${text}\nTranslated (${lang}): ${translated}`,
      });
    } catch {
      await context.socket.sendMessage(context.fromJid, { text: '❌ Translation failed.' });
    }
  },
};

const defineCmd: CommandModule = {
  config: {
    name: 'define',
    description: 'Define a word',
    usage: '!define <word>',
    category: 'basic',
  },
  handler: async function (context, args: string[]): Promise<void> {
    const word = args[0];
    if (!word) {
      await context.socket.sendMessage(context.fromJid, { text: 'Usage: !define <word>' });
      return;
    }
    try {
      const response = await axios.get(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
      );
      const data = response.data[0];
      const meaning = data.meanings[0];
      const definition = meaning.definitions[0].definition;
      const example = meaning.definitions[0].example || 'No example';
      await context.socket.sendMessage(context.fromJid, {
        text: `📖 *${data.word}*\n\n📝 ${definition}\n\n💬 Example: ${example}\n\n🔊 ${data.phonetics[0]?.text || ''}`,
      });
    } catch {
      await context.socket.sendMessage(context.fromJid, {
        text: `❌ Could not find definition for "${word}"`,
      });
    }
  },
};

const calcCmd: CommandModule = {
  config: {
    name: 'calc',
    description: 'Calculator',
    usage: '!calc <expression>',
    category: 'basic',
  },
  handler: async function (context, args: string[]): Promise<void> {
    const expression = args.join(' ');
    if (!expression) {
      await context.socket.sendMessage(context.fromJid, {
        text: 'Usage: !calc <expression>\n\nExample: !calc 2+2*3',
      });
      return;
    }
    try {
      const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
      // eslint-disable-next-line no-eval
      const result = eval(sanitized);
      await context.socket.sendMessage(context.fromJid, {
        text: `🔢 *Calculator*\n\nExpression: ${expression}\nResult: ${result}`,
      });
    } catch {
      await context.socket.sendMessage(context.fromJid, { text: '❌ Invalid math expression.' });
    }
  },
};

const reverseCmd: CommandModule = {
  config: {
    name: 'reverse',
    description: 'Reverse text',
    usage: '!reverse <text>',
    category: 'basic',
  },
  handler: async function (context, args: string[]): Promise<void> {
    const text = args.join(' ');
    if (!text) {
      await context.socket.sendMessage(context.fromJid, { text: 'Usage: !reverse <text>' });
      return;
    }
    const reversed = text.split('').reverse().join('');
    await context.socket.sendMessage(context.fromJid, { text: `🔄 *Reversed:* ${reversed}` });
  },
};

const binaryCmd: CommandModule = {
  config: {
    name: 'binary',
    description: 'Convert text to binary',
    usage: '!binary <text>',
    category: 'basic',
  },
  handler: async function (context, args: string[]): Promise<void> {
    const text = args.join(' ');
    if (!text) {
      await context.socket.sendMessage(context.fromJid, { text: 'Usage: !binary <text>' });
      return;
    }
    const binary = text
      .split('')
      .map((char) => char.charCodeAt(0).toString(2).padStart(8, '0'))
      .join(' ');
    await context.socket.sendMessage(context.fromJid, { text: `🔢 *Binary:* ${binary}` });
  },
};

const quoteCmd: CommandModule = {
  config: {
    name: 'quote',
    description: 'Random quote',
    usage: '!quote',
    category: 'basic',
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

const weatherCmd: CommandModule = {
  config: {
    name: 'weather',
    description: 'Get weather info',
    usage: '!weather <city>',
    category: 'basic',
  },
  handler: async function (context, args: string[]): Promise<void> {
    const city = args.join(' ');
    if (!city) {
      await context.socket.sendMessage(context.fromJid, {
        text: 'Usage: !weather <city>\n\nExample: !weather London',
      });
      return;
    }
    try {
      const response = await axios.get(
        `https://wttr.in/${encodeURIComponent(city)}?format=4`
      );
      await context.socket.sendMessage(context.fromJid, {
        text: `🌤️ *Weather*\n\n${response.data}`,
      });
    } catch {
      await context.socket.sendMessage(context.fromJid, {
        text: `❌ Could not get weather for "${city}"`,
      });
    }
  },
};

export default [translateCmd, defineCmd, calcCmd, reverseCmd, binaryCmd, quoteCmd, jokeCmd, weatherCmd];
