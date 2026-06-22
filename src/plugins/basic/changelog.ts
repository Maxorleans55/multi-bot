import type { CommandModule } from '../../types/index.js';
import { getPrefixes } from '../../config/botConfig.js';

const changelogCommand: CommandModule = {
  config: {
    name: 'changelog',
    aliases: ['cl', 'update', 'perubahan'],
    description: 'Lihat apa aja yang baru di bot ini',
    usage: '!changelog',
    category: 'basic',
  },
  handler: async function (context): Promise<void> {
    const prefixes = getPrefixes();
    const matchedPrefix = context.simplified?.matchedPrefix || prefixes[0] || '!';

    const text = `╭━━━━━━━━━━━━━━━━━━╮
┃      📋 *CHANGELOG*     
┃   _Apa yang baru?_
╰━━━━━━━━━━━━━━━━━━╯

📅 *22 Juni 2026*

╭━━━「 🔥 *Cari & Baca Web* 」━━━╮
┃
┃ • *Baca halaman web* — Sekarang
┃   bot bisa baca artikel, berita,
┃   atau halaman web apa pun.
┃   Tinggal kirim URL, bot bakal
┃   bacain dan kasih ringkasannya.
┃
┃ • *Cari info* — Mau tau harga
┃   emas, cuaca, berita terbaru?
┃   Tinggal tanya aja, bot bakal
┃   search langsung dari internet.
┃
╰━━━━━━━━━━━━━━━━━━╯

╭━━━「 🧠 *AI Makin Pinter* 」━━━╮
┃
┃ • *Tau tanggal & jam* — Sekarang
┃   AI tau hari ini tanggal berapa
┃   jadi jawabannya nggak bakal
┃   ngelantur tahun kemarin.
┃
┃ • *Search makin akurat* — pas
┃   nyari info, udah diatur biar
┃   dapet yang paling baru.
┃
┃ • *Di grup juga bisa* — Fitur
┃   search dan baca web udah bisa
┃   dipake di chat grup juga.
┃
╰━━━━━━━━━━━━━━━━━━╯

╭━━━「 ⚙️ *Lainnya* 」━━━╮
┃
┃ • Bersihin kode biar lebih
┃   ringan dan cepat.
┃
╰━━━━━━━━━━━━━━━━━━╯

╭━━━「 📌 *INFO* 」━━━╮
┃
┃ ✦ Ketik \`${matchedPrefix}help\` buat
┃   liat semua perintah.
┃ ✦ Ada bug? Lapor lewat
┃   \`${matchedPrefix}reportbug\`
┃
╰━━━━━━━━━━━━━━━━━━╯`;
    await context.socket.sendMessage(context.fromJid, { text });
  },
};

export default changelogCommand;
