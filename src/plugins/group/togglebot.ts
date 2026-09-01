import type { CommandModule } from '../../types/index.js';
import { isOwner } from '../../config/botConfig.js';
import { isAIGroupEnabled, setAIGroupEnabled } from '../../services/groupToggle.js';

const togglebotCommand: CommandModule = {
  config: {
    name: 'aigroup',
    aliases: ['gai', 'aiGroup'],
    description: 'Enable/disable AI in this group',
    usage: '!aigroup on / !aigroup off',
    category: 'group',
  },
  handler: async function (context, args: string[]): Promise<void> {
    if (!context.fromJid.endsWith('@g.us')) {
      await context.socket.sendMessage(context.fromJid, {
        text: '❌ This command can only be used in groups.',
      });
      return;
    }

    const userId = context.simplified?.user_id || context.fromJid;
    const participantJid = userId;

    const isGroupAdmin = await (async () => {
      if (context.fromMe || isOwner(participantJid)) return true;
      try {
        const metadata = await context.socket.groupMetadata(context.fromJid);
        const participant = metadata.participants.find((p: any) =>
          participantJid.includes(p.id.split('@')[0])
        );
        return participant?.admin === 'admin' || participant?.admin === 'superadmin';
      } catch {
        return false;
      }
    })();

    if (!isGroupAdmin) {
      await context.socket.sendMessage(context.fromJid, {
        text: '❌ Only group admins can use this command.',
      });
      return;
    }

    const action = args[0]?.toLowerCase();
    const currentStatus = isAIGroupEnabled(context.fromJid);

    if (!action || (action !== 'on' && action !== 'off')) {
      const statusText = currentStatus ? '🟢 *Active*' : '🔴 *Inactive*';
      await context.socket.sendMessage(context.fromJid, {
        text: `📋 *AI Status in This Group:* ${statusText}\n\nUsage:\n• \`${context.simplified?.prefix || '!'}aigroup on\` — Enable AI\n• \`${context.simplified?.prefix || '!'}aigroup off\` — Disable AI`,
      });
      return;
    }

    if (action === 'on') {
      if (currentStatus) {
        await context.socket.sendMessage(context.fromJid, {
          text: '🟢 AI is already active in this group.',
        });
        return;
      }
      await setAIGroupEnabled(context.fromJid, true);
      await context.socket.sendMessage(context.fromJid, {
        text: '🟢 AI has been *enabled* in this group.',
      });
    } else {
      if (!currentStatus) {
        await context.socket.sendMessage(context.fromJid, {
          text: '🔴 AI is already inactive in this group.',
        });
        return;
      }
      await setAIGroupEnabled(context.fromJid, false);
      await context.socket.sendMessage(context.fromJid, {
        text: '🔴 AI has been *disabled* in this group.',
      });
    }
  },
};

export default togglebotCommand;
