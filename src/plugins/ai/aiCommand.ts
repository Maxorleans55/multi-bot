import type { WASocket } from '@innovatorssoft/baileys';
import type { CommandModule } from '../../types/index.js';
import type { ToolContext } from '../../types/tools.js';
import aiService, { AIService } from '../../services/aiService.js';
import { isOwner } from '../../config/botConfig.js';
import { getSystemPrompt } from '../../services/systemPrompt.js';

const ACTIVE_SESSIONS = new Map<string, { enabled: boolean; mode: 'single' | 'chat' }>();

const DEFAULT_SYSTEM_PROMPT = getSystemPrompt();

const AICommand: CommandModule = {
  config: {
    name: 'ai',
    aliases: ['ask', 'chatai', 'aioff', 'aion'],
    description: 'Aktifkan mode AI untuk chatting',
    usage: '!ai <pertanyaan>',
    category: 'ai',
  },
  onLoad() {
    console.log('✅ AI Command loaded');
  },
  handler: async function (context, args: string[]): Promise<void> {
    const userId = context.simplified?.user_id || context.fromJid;

    if (args[0]?.toLowerCase() === 'on') {
      ACTIVE_SESSIONS.set(userId, { enabled: true, mode: 'chat' });
      await context.socket.sendMessage(context.fromJid, {
        text: '✅ Mode AI aktif! Semua pesan yang kamu kirim akan ditangani oleh AI.\n\nGunakan !aioff untuk menonaktifkan mode AI.',
      });
      return;
    }

    if (args[0]?.toLowerCase() === 'off') {
      aiService.clearConversation(userId);
      ACTIVE_SESSIONS.delete(userId);
      await context.socket.sendMessage(context.fromJid, {
        text: '❌ Mode AI dinonaktifkan. Kembali ke mode perintah normal.',
      });
      return;
    }

    if (args[0]?.toLowerCase() === 'model' && args[1]) {
      if (!isOwner(userId)) {
        await context.socket.sendMessage(context.fromJid, {
          text: '❌ Hanya owner yang bisa mengganti model AI.',
        });
        return;
      }
      const model = args.slice(1).join(' ');
      aiService.setModel(model);
      await context.socket.sendMessage(context.fromJid, {
        text: `✅ Model AI diganti ke: ${model}`,
      });
      return;
    }

    if (args[0]?.toLowerCase() === 'clear') {
      aiService.clearConversation(userId);
      await context.socket.sendMessage(context.fromJid, {
        text: '🧹 Percakapan AI dibersihkan.',
      });
      return;
    }

    if (args[0]?.toLowerCase() === 'models') {
      const provider = aiService.getProvider();
      let models: string[] = [];
      let info = '';

      if (provider === 'ollama') {
        models = await AIService.listOllamaModels();
        if (models.length === 0) {
          info = '\n\n⚠️ Tidak bisa terhubung ke Ollama. Pastikan Ollama berjalan dan `OLLAMA_BASE_URL` benar.';
        }
        info += '\n\nGunakan `!ai model <nama model>` untuk mengganti (hanya owner).';
      } else if (provider === 'openai' || provider === 'other') {
        // OpenAI-compatible custom API — coba fetch dari endpoint /models
        models = await AIService.getAvailableModels(provider);
        if (models.length === 0) {
          info = '\n\n⚠️ Tidak bisa mengambil daftar model dari API. Set model manual dengan `!ai model <nama model>`.';
        } else {
          info = '\n\nGunakan `!ai model <nama model>` untuk mengganti (hanya owner).';
        }
      } else {
        // openrouter
        models = await AIService.getAvailableModels('openrouter');
        if (models.length === 0) {
          models = AIService.getAvailableOpenRouterModels();
        }
        info = '\n\nGunakan `!ai model <nama model>` untuk mengganti (hanya owner).';
      }

      const modelList = models.map((m: string) => `• ${m}`).join('\n');
      await context.socket.sendMessage(context.fromJid, {
        text: `🤖 *Model ${provider.toUpperCase()} yang Tersedia:*\n\n${modelList}\n\nModel saat ini: ${aiService.getModel()}${info}`,
      });
      return;
    }

    if (!aiService.isConfigured()) {
      await context.socket.sendMessage(context.fromJid, {
        text: '❌ AI service belum dikonfigurasi. Hubungi owner bot.',
      });
      return;
    }

    const question = args.join(' ');

    if (!question) {
      await context.socket.sendMessage(context.fromJid, {
        text: `📖 *Cara Penggunaan AI:*

• ${context.simplified?.prefix || '!'}ai on - Aktifkan mode AI
• ${context.simplified?.prefix || '!'}ai off - Nonaktifkan mode AI
• ${context.simplified?.prefix || '!'}ai <pertanyaan> - Tanya AI langsung
• ${context.simplified?.prefix || '!'}ai clear - Bersihkan percakapan
• ${context.simplified?.prefix || '!'}ai models - Lihat model yang tersedia

🔹 Mode AI aktif: ${ACTIVE_SESSIONS.has(userId) ? 'Ya' : 'Tidak'}`,
      });
      return;
    }

    await context.socket.sendPresenceUpdate('composing', context.fromJid);

    try {
      const toolContext: ToolContext = {
        socket: context.socket,
        fromJid: context.fromJid,
        sessionId: userId,
        pushName: context.simplified?.pushName ?? undefined,
      };

      let responseBuffer = '';
      await aiService.chatWithTools(
        userId,
        question,
        DEFAULT_SYSTEM_PROMPT,
        (chunk) => {
          if (!chunk.done && chunk.content) {
            responseBuffer = chunk.content;
          }
        },
        toolContext
      );

      await context.socket.sendPresenceUpdate('paused', context.fromJid);

      if (responseBuffer) {
        await context.socket.sendMessage(context.fromJid, {
          text: responseBuffer,
        });
      }
    } catch (error: any) {
      await context.socket.sendPresenceUpdate('paused', context.fromJid);
      await context.socket.sendMessage(context.fromJid, {
        text: `❌ Error: ${error.message}`,
      });
    }
  },
};

export function isAIModeEnabled(userId: string): boolean {
  return ACTIVE_SESSIONS.get(userId)?.enabled ?? false;
}

export function getAIMode(userId: string): 'single' | 'chat' {
  return ACTIVE_SESSIONS.get(userId)?.mode ?? 'single';
}

export function handleAIMessage(userId: string, message: string): Promise<string> {
  return aiService.chat(userId, message, DEFAULT_SYSTEM_PROMPT);
}

export function clearAISession(userId: string): void {
  aiService.clearConversation(userId);
  ACTIVE_SESSIONS.delete(userId);
}

export default AICommand;