# Bot-Baileys-AI — AGENT.md

> Panduan untuk AI Agent & Developer yang bekerja pada project ini.
> **Versi:** 1.0.0 | **Bahasa:** TypeScript (ESM) | **Database:** MongoDB via Prisma

---

## 📋 Project Overview

WhatsApp bot multi-session menggunakan **Baileys** (WebSocket library for WhatsApp) dengan arsitektur plugin-based. Mendukung AI multi-provider, auto-download media sosial, manajemen grup, dan session management.

### Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Runtime | Node.js 20+ |
| Bahasa | TypeScript 6.x (ESM) |
| WhatsApp API | [@innovatorssoft/baileys](https://www.npmjs.com/package/@innovatorssoft/baileys) |
| Database | MongoDB via Prisma ORM |
| AI Provider | OpenAI, OpenRouter, Ollama |
| Package Manager | pnpm |
| Container | Docker (multi-stage build) |

---

## 🏗️ Architecture Layers

```
src/
├── index.ts              # Entry point — CLI arg parsing, graceful shutdown
├── bot/
│   ├── botHandler.ts     # Core message processor (simplify, route, AI, download)
│   └── autoDownload.ts   # Social media auto-download (IG, TT, FB, YT, Twitter)
├── config/
│   └── botConfig.ts      # Config loader (config.json > ENV > default)
├── database/
│   └── prisma.ts         # Prisma client singleton
├── libs/
│   └── baileys/
│       └── usePrismaAuthState.ts  # Baileys auth persistence ke MongoDB
├── plugins/
│   ├── pluginManager.ts  # Plugin loader & command dispatcher
│   ├── ai/               # !ai command
│   ├── basic/            # !help, !ping, !reportbug, !status, !testbutton
│   ├── group/            # !hidetag, !setgroup, !togglebot
│   ├── media/            # !tiktok, !instagram, !facebook, !youtube, !pinterest, !sticker, !toimg
│   ├── owner/            # !eval, !exec
│   └── session/          # !create_session, !disconnect, !listsessions
├── services/
│   ├── aiService.ts      # AI provider abstraction (streaming, history)
│   ├── aiModeHandler.ts  # AI mode toggle per user
│   └── groupToggle.ts    # Group AI enable/disable
├── session/
│   ├── sessionManager.ts # Singleton — session lifecycle, reconnect, QR
│   ├── sessionHelper.ts  # Bridge — SessionManager ↔ BotHandler
│   └── authStateDB.ts    # (deprecated)
├── types/
│   ├── command.ts        # CommandContext, CommandConfig, CommandHandler
│   ├── plugin.ts         # Plugin, PluginModule, CategoryPlugin, CommandModule
│   └── nexo-aio-downloader.d.ts
└── utils/
    ├── logger.ts         # Logging utility (level-based)
    ├── pinterest.ts      # Pinterest download helper
    └── youtubeButtonHandler.ts  # YouTube interactive button handler
```

---

## 🧠 Key Architecture Decisions

### 1. Multi-Session via Singleton SessionManager
- [`SessionManager`](src/session/sessionManager.ts:26) adalah **singleton** yang mengelola semua koneksi WebSocket.
- Setiap session memiliki `WASocket` sendiri yang disimpan di `Map<sessionId, WASocket>`.
- **Auto-reconnect** dengan exponential backoff (1s → 2s → 4s → 8s → 16s → max 30s), max 5 attempts.
- **Session filtering** via `INCLUDE_SESSIONS` / `EXCLUDE_SESSIONS` environment variables.

### 2. Plugin System Dua Mode
- **Legacy Plugin** (`PluginModule`): Satu file ekspor `default` dengan `commands[]`, `handlers{}`, lifecycle hooks.
- **Category Plugin** (`CommandModule`): Per-file dalam folder, auto-discover oleh PluginManager.
- **Permission system**: `ownerOnly`, `adminOnly`, `groupOnly`, `privateOnly`.

### 3. AI Multi-Provider
- [`AIService`](src/services/aiService.ts:19) mendukung **OpenAI-compatible**, **OpenRouter**, dan **Ollama**.
- **Streaming response** via SSE (OpenAI/OpenRouter) atau JSON Lines (Ollama).
- **Conversation history** disimpan per sessionId, expiry 10 menit untuk grup.
- OpenRouter spesifik: tools `openrouter:datetime` dan `openrouter:web_search`.

### 4. Message Processing Flow
1. `messages.upsert` event → `BotHandler.handleMessage()`
2. `simplified()` → Parse raw WAMessage ke objek terstruktur
3. `processMessage()` → Route: Command → AI Mode → Auto-Download → Button → Group Reply

### 5. Auth State Persistence
- [`usePrismaAuthState`](src/libs/baileys/usePrismaAuthState.ts:67) implement interface `AuthenticationState` Baileys.
- `creds` disimpan sebagai satu baris, `keys` disimpan per-item.
- Compound unique `(sessionId, type, key)` untuk upsert.

---

## 📐 Coding Conventions

### TypeScript / ESM
- Semua file menggunakan **ESM** (`import`/`export`, `type: "module"` di package.json).
- Path import harus dengan **.js extension** (contoh: `'../services/aiService.js'`).
- Gunakan `type` imports untuk type-only imports.

### Plugin Development
- Setiap plugin file harus memiliki **default export**.
- **Legacy Plugin**: export `PluginModule` dengan `commands`, `handlers`, `onLoad`, `onUnload`.
- **Category Plugin**: export `CommandModule` dengan `config`, `handler`, `onLoad`, `onUnload`.
- Command name harus **lowercase**.
- Gunakan `CommandConfig` untuk permission dan metadata.

```typescript
// Contoh Category Plugin (recommended)
export default {
  config: {
    name: 'mycommand',
    aliases: ['mc'],
    description: 'Deskripsi command',
    usage: '!mycommand <arg>',
    category: 'basic',
    ownerOnly: false,
    groupOnly: false,
  },
  handler: async (context: CommandContext, args: string[]) => {
    // context.socket, context.fromJid, context.sessionId, dll
    await context.socket.sendMessage(context.fromJid, { text: 'Hello!' });
  },
};
```

### Error Handling
- Gunakan try-catch di setiap handler async.
- Jangan biarkan promise unhandled rejection.
- Log error dengan `log.error()` dari [`src/utils/logger.ts`](src/utils/logger.ts:21).

### Logging
- Gunakan [`log`](src/utils/logger.ts:21) object: `log.info()`, `log.error()`, `log.warn()`, `log.debug()`.
- Level dikontrol via `LOG_LEVEL` env: `silent`, `error`, `warn`, `info`, `debug`.
- Production default: `silent` (kecuali `LOG_LEVEL` diset).

---

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | **Yes** | - | MongoDB connection string |
| `OWNER_NUMBERS` | No | `[]` | Owner WhatsApp numbers (comma-separated) |
| `PREFIXES` | No | `!` | Command prefixes |
| `AI_PROVIDER` | No | `openrouter` | `openai`, `openrouter`, or `ollama` |
| `OPENAI_API_KEY` | No | - | OpenAI API key |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | OpenAI base URL |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model |
| `OPENROUTER_API_KEY` | No | - | OpenRouter API key |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | OpenRouter base URL |
| `OPENROUTER_MODEL` | No | `anthropic/claude-3-haiku` | OpenRouter model |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | No | `llama3.2` | Ollama model |
| `INCLUDE_SESSIONS` | No | - | Session IDs to load only |
| `EXCLUDE_SESSIONS` | No | - | Session IDs to skip |
| `LOG_LEVEL` | No | `info` | Log level |
| `NODE_ENV` | No | - | `development` or `production` |
| `MAINTENANCE` | No | `false` | Maintenance mode |
| `MAINTENANCE_MESSAGE` | No | - | Custom maintenance message |

---

## 🚀 Development Workflow

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm prisma:generate

# Push schema to MongoDB
pnpm prisma:migrate

# Run in development mode (auto-reload)
pnpm dev

# Run specific session only
pnpm dev:dev

# Type check
pnpm type-check

# Build
pnpm build

# Production
pnpm start
```

### CLI Arguments
| Argument | Description |
|----------|-------------|
| `--session=<id>` | Create/replace session with specific ID |
| `--force-clear` | Clear existing auth data |
| `--only` | Run ONLY the specified session (skip DB sessions) |

### Docker
```bash
docker build -t bot-baileys-ai .
docker run -e DATABASE_URL=mongodb://host.docker.internal:27017/bot_baileys bot-baileys-ai
```

---

## 🌐 Deployment

- **Docker multi-stage build** — Builder (heavy) → Runtime (slim).
- Runtime dependencies: `python3`, `libvips`, `openssl`, `ffmpeg`, `tini`.
- Default `EXCLUDE_SESSIONS=dev` di production.
- Gunakan `tini` sebagai PID 1 untuk signal forwarding yang proper.

---

## 🔐 Security Notes

- Owner numbers sensitive — simpan di `.env` atau `config.json`, jangan di commit.
- AI API keys sensitive — jangan pernah expose di log atau response.
- `!eval` dan `!exec` adalah owner-only commands — sangat berbahaya jika bocor.
- Pastikan `DATABASE_URL` tidak pernah ter-expose.

---

## 📚 Useful Commands Reference

| Command | Description | Category |
|---------|-------------|----------|
| `!help` | Show all commands | basic |
| `!ping` | Check bot latency | basic |
| `!status` | Show bot status | basic |
| `!reportbug` | Report a bug | basic |
| `!ai <question>` | Ask AI | ai |
| `!ai on/off` | Toggle AI mode | ai |
| `!ai model <name>` | Change AI model (owner) | ai |
| `!ai models` | List available models | ai |
| `!tiktok <url>` | Download TikTok | media |
| `!instagram <url>` | Download Instagram | media |
| `!youtube <url>` | Download YouTube | media |
| `!facebook <url>` | Download Facebook | media |
| `!pinterest <query>` | Search Pinterest | media |
| `!sticker` | Make sticker from image | media |
| `!hidetag` | Hidden tag all members | group |
| `!setgroup` | Group settings | group |
| `!togglebot` | Toggle bot in group | group |
| `!eval <code>` | Execute JS (owner) | owner |
| `!exec <cmd>` | Execute shell (owner) | owner |
| `!create_session` | Create new session | session |
| `!disconnect` | Disconnect session | session |
| `!listsessions` | List all sessions | session |

---

> **File ini diperuntukkan sebagai panduan konteks untuk AI Agent dan Developer.**
> Update sesuai dengan perubahan arsitektur dan konvensi project.
