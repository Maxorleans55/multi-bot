import type { CommandModule, CommandConfig } from '../../types/index.js';
import { getPrefixes, isOwner } from '../../config/botConfig.js';
import { join } from 'path';
import { readFileSync } from 'fs';
import sharp from 'sharp';

const categoryIcons: Record<string, string> = {
  general: '🤖',
  tools: '🧰',
  ai: '🧠',
  media: '📥',
  group: '👥',
  owner: '👑',
  session: '🔐',
};

interface CommandEntry {
  config: CommandConfig;
  plugin: string;
}

const helpCommand: CommandModule = {
  config: {
    name: 'help',
    aliases: ['h', 'menu'],
    description: 'Show all available commands',
    usage: '!help',
    category: 'general',
  },
  handler: async function (context, args: string[]): Promise<void> {
    const pm = context.pluginManager;
    if (!pm) {
      await context.socket.sendMessage(context.fromJid, {
        text: '❌ Plugin manager not available',
      });
      return;
    }

    const prefixes = getPrefixes();
    const matchedPrefix = context.simplified?.matchedPrefix || prefixes[0] || '!';

    const senderJid = context.simplified?.user_id || context.fromJid || '';
    const isOwnerUser = isOwner(senderJid);

    const allCommands = pm.getAllCommands();

    const selfAliases = ['help', 'h', 'menu'];

    if (args.length > 0 && !selfAliases.includes(args[0].toLowerCase())) {
      const commandName = args[0].toLowerCase();
      const command = pm.getCommand(commandName);

      if (command && (!command.config.ownerOnly || isOwnerUser)) {
        const aliasesText = command.config.aliases
          ? `\n┃ ✦ *Alias:* ${command.config.aliases.map((a: string) => `\`${matchedPrefix}${a}\``).join(', ')}`
          : '';

        const helpText =
`╭━━━━━「 📖 *${command.config.name.toUpperCase()}* 」━━━━━╮
┃
┃ ${command.config.description}
┃
┃ ✦ *Usage:* \`${command.config.usage.replace('!', matchedPrefix)}\`${aliasesText}
┃ ✦ *Category:* ${categoryIcons[command.config.category || ''] || '📁'} ${command.config.category || 'general'}
┃ ✦ *Admin:* ${command.config.adminOnly ? '✅ Yes' : '❌ No'}
┃ ✦ *Owner:* ${command.config.ownerOnly ? '✅ Yes' : '❌ No'}
┃ ✦ *Premium:* ${command.config.premiumOnly ? '✅ Yes' : '❌ No'}
┃
╰━━━━━━━━━━━━━━━━━━━╯`;

        await context.socket.sendMessage(context.fromJid, {
          text: helpText,
        });
      } else {
        await context.socket.sendMessage(context.fromJid, {
          text: `❌ Command \`${matchedPrefix}${commandName}\` not found.`,
        });
      }
    } else {
      const categories = new Map<string, CommandEntry[]>();

      for (const cmd of allCommands) {
        if (cmd.config.ownerOnly && !isOwnerUser) {
          continue;
        }

        const category = cmd.config.category || 'general';
        if (!categories.has(category)) {
          categories.set(category, []);
        }
        categories.get(category)!.push(cmd);
      }

      let menuText = '';

      const categoryOrder = ['general', 'tools', 'ai', 'media', 'group', 'owner', 'session'];
      const sortedCategories = categoryOrder
        .filter(cat => categories.has(cat))
        .map(cat => [cat, categories.get(cat)!] as const);

      for (const [category, commands] of sortedCategories) {
        const icon = categoryIcons[category] || '📁';
        const catName = category.charAt(0).toUpperCase() + category.slice(1);

        menuText +=
`╭━━━「 ${icon} *${catName}* 」━━━╮
┃
${commands.map(cmd => {
  const aliases = cmd.config.aliases?.length ? ` _(${cmd.config.aliases.slice(0, 2).join(', ')}${cmd.config.aliases.length > 2 ? ',...' : ''})_` : '';
  return `┃ ✦ \`${matchedPrefix}${cmd.config.name}\`${aliases}\n┃   ${cmd.config.description}`;
}).join('\n┃\n')}
┃
╰━━━━━━━━━━━━━━━━━━━╯

`;
      }

      menuText +=
`╭━━━「 📌 *INFO* 」━━━╮
┃
┃ ✦ *Session:* ${context.sessionId}
┃ ✦ *Prefix:* \`${matchedPrefix}\`
┃ ✦ *Owner:* Max Shadows
┃
╰━━━━━━━━━━━━━━━━━━━╯`;

      try {
        const imagePath = join(process.cwd(), 'public', 'light-yagami.png');
        const imageBuffer = readFileSync(imagePath);
        const resizedBuffer = await sharp(imageBuffer)
          .resize(800, 800, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        await context.socket.sendMessage(context.fromJid, {
          image: resizedBuffer,
          caption: menuText,
        });
      } catch (err) {
        console.error(`[help] Failed to load/send image, falling back to text:`, err);
        await context.socket.sendMessage(context.fromJid, {
          text: menuText,
        });
      }
    }
  },
};

export default helpCommand;
