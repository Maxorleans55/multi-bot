import type { CommandModule, CommandContext } from '../../types/index.js';
import { isOwner } from '../../config/botConfig.js';
import { userService } from '../../services/userService.js';

const command: CommandModule = {
  config: {
    name: 'user',
    aliases: ['users', 'userlist'],
    description: 'List and manage bot users',
    usage: '!user <list|stats>',
    category: 'owner',
    ownerOnly: true,
    cooldown: 3,
    limitEnabled: false,
  },
  handler: async (context: CommandContext, args: string[]) => {
    const sub = args[0]?.toLowerCase();
    const from = context.fromJid;

    if (!isOwner(context.simplified?.user_id || from)) {
      await context.socket.sendMessage(from, { text: '❌ Owner only.' });
      return;
    }

    switch (sub) {
      case 'list': {
        const filter = args[1]?.toLowerCase();
        let statusFilter: 'active' | 'inactive' | undefined;
        if (filter === 'active') statusFilter = 'active';
        else if (filter === 'inactive') statusFilter = 'inactive';
        else if (filter && filter !== 'all') {
          await context.socket.sendMessage(from, { text: '❌ Usage: !user list <active|inactive|all>' });
          return;
        }
        const users = await userService.getUsers({ status: statusFilter, limit: 30 });
        if (users.length === 0) {
          await context.socket.sendMessage(from, { text: `📋 Tidak ada user${statusFilter ? ` dengan status *${statusFilter}*` : ''}.` });
          return;
        }
        const label = statusFilter ? statusFilter.toUpperCase() : 'ALL';
        const lines = [`📋 *User List — ${label}* (${users.length})`, ''];
        for (const u of users) {
          const name = u.pushName || '(no name)';
          const tier = u.tier !== 'free' ? ` [${u.tier.toUpperCase()}]` : '';
          lines.push(`• \`${u.userId.split('@')[0]}\` — ${name}${tier}`);
        }
        await context.socket.sendMessage(from, { text: lines.join('\n') });
        break;
      }

      case 'stats': {
        const stats = await userService.getStats();
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const lines = [
          `👥 *Statistik User*`,
          ``,
          `📊 *Total:* ${stats.total}`,
          `├ Aktif (7 hari): ${stats.active}`,
          `├ Tidak Aktif: ${stats.inactive}`,
          ``,
          `⭐ *Tier:*`,
          `├ Free: ${stats.free}`,
          `├ Premium: ${stats.premium}`,
          `└ Pro: ${stats.pro}`,
          ``,
          `📅 *Cutoff inactive:* ${sevenDaysAgo.toLocaleDateString('id-ID')}`,
        ];
        await context.socket.sendMessage(from, { text: lines.join('\n') });
        break;
      }

      default:
        await context.socket.sendMessage(from, {
          text: `📋 *User Commands*\n\n` +
            `*!user list active* — List user aktif (7 hari terakhir)\n` +
            `*!user list inactive* — List user tidak aktif (>7 hari)\n` +
            `*!user list all* — List semua user\n` +
            `*!user stats* — Statistik user`,
        });
    }
  },
};

export default command;
