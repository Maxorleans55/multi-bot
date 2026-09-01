import type { CommandModule } from '../../types/index.js';
import { getPrefixes } from '../../config/botConfig.js';

const changelogCommand: CommandModule = {
  config: {
    name: 'changelog',
    aliases: ['cl', 'update', 'perubahan'],
    description: 'See what\'s new in the bot',
    usage: '!changelog',
    category: 'general',
  },
  handler: async function (context): Promise<void> {
    const prefixes = getPrefixes();
    const matchedPrefix = context.simplified?.matchedPrefix || prefixes[0] || '!';

    const text = `╭━━━━━━━━━━━━━━━━━━╮
┃      📋 *CHANGELOG*     
┃   _What's new?_
╰━━━━━━━━━━━━━━━━━━╯

📅 *17 August 2026*

╭━━━━━「 📨 *Telegram Sticker Pack* 」━━━━━╮
┃
┃ • *Feat:* Convert Telegram sticker packs
┃   (t.me/addstickers) into WhatsApp
┃   sticker packs.
┃
┃ • *Usage:* \`!tgstickerpack <url/name>\`
┃
╰━━━━━━━━━━━━━━━━━━╯

╭━━━━━「 📌 *Pinterest Sticker Pack* 」━━━━━╮
┃
┃ • *Feat:* Create multiple stickers from
┃   Pinterest at once, sent as one
┃   sticker pack (max 50).
┃
┃ • *Usage:* \`!pinsticker <url/keyword>\`
┃   or ask the AI directly.
┃
╰━━━━━━━━━━━━━━━━━━╯

📅 *15 August 2026*

╭━━━━━「 📦 *Sticker Pack* 」━━━━━╮
┃
┃ • *Feat:* Create & send *sticker packs*
┃   directly from WhatsApp.
┃
┃ • *Feat:* Album support — reply to
┃   multiple media at once to create
┃   one pack (max 60 stickers).
┃
┃ • *Usage:* \`!stickerpack <Name|Publisher>\`
┃   → \`!stickerpack add\` → \`!stickerpack send\`
┃
╰━━━━━━━━━━━━━━━━━━╯

📅 *14 August 2026*

╭━━━━━「 🧠 *Faster AI* 」━━━━━╮
┃
┃ • *Feat:* New AI engine — faster &
┃   more stable responses.
┃
┃ • *Fix:* Web search & page reading
┃   no longer fails easily.
┃
╰━━━━━━━━━━━━━━━━━━╯

╭━━━━━「 📸 *Instagram Fix* 」━━━━━╮
┃
┃ • *Fix:* Videos failing to upload to
┃   WhatsApp story (codec mismatch)
┃   are now safe.
┃
┃ • *Fix:* Clear error messages when
┃   download fails.
┃
╰━━━━━━━━━━━━━━━━━━╯

📅 *25 July 2026*

╭━━━━━「 💎 *Premium System* 」━━━━━╮
┃
┃ • *Feat:* New tiers — *free*,
┃   *premium*, & *pro*.
┃
┃ • *Feat:* Daily AI & command usage
┃   limits per user.
┃
╰━━━━━━━━━━━━━━━━━━╯

📅 *30 June 2026*

╭━━━「 📸 *Instagram Download* 」━━━╮
┃
┃ • *Fix:* "Failed to extract media URL
┃   from Instagram" error when
┃   downloading Reels/photos/slides.
┃
┃ • *Fix:* Reels videos now have audio.
┃
┃ • *Fix:* AI mode can download from
┃   Instagram again.
┃
╰━━━━━━━━━━━━━━━━━━╯

📅 *22 June 2026*

╭━━━「 🔥 *Web Search & Read* 」━━━╮
┃
┃ • *Feat:* Bot can read web pages —
┃   just send a URL and the bot
┃   reads and summarizes it.
┃
┃ • *Feat:* Search the internet directly
┃   — gold prices, weather, news,
┃   just ask.
┃
╰━━━━━━━━━━━━━━━━━━╯

╭━━━「 🧠 *Smarter AI* 」━━━╮
┃
┃ • *Feat:* AI now knows the date &
┃   time, so answers don't go off
┃   track.
┃
┃ • *Feat:* Search optimized for the
┃   latest & most accurate results.
┃
┃ • *Feat:* Search & web reading work
┃   in groups too.
┃
╰━━━━━━━━━━━━━━━━━━╯

╭━━━「 ⚙️ *Other* 」━━━╮
┃
┃ • *Style:* Cleaned up & optimized
┃   code for better performance.
┃
╰━━━━━━━━━━━━━━━━━━╯

╭━━━「 📌 *INFO* 」━━━╮
┃
┃ ✦ Type \`${matchedPrefix}help\` to see
┃   all commands.
┃ ✦ Found a bug? Report via
┃   \`${matchedPrefix}reportbug\`
┃
╰━━━━━━━━━━━━━━━━━━╯`;
    await context.socket.sendMessage(context.fromJid, { text });
  },
};

export default changelogCommand;
