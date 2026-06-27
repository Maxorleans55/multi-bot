# Bot-Baileys-AI — AGENT.md

> Panduan untuk AI Agent & Developer yang bekerja pada project ini.
> **Versi:** 1.1.0 | **Bahasa:** TypeScript (ESM) | **Database:** MongoDB via Prisma

---

## 📋 Project Overview

WhatsApp bot multi-session menggunakan **Baileys** (WebSocket library for WhatsApp) dengan arsitektur plugin-based. Mendukung AI multi-provider, auto-download media sosial, manajemen grup, session management, dan **AI function calling** untuk eksekusi tools secara cerdas.

### Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Runtime | Node.js 20+ |
| Bahasa | TypeScript 6.x (ESM) |
| WhatsApp API | [@innovatorssoft/baileys](https://www.npmjs.com/package/@innovatorssoft/baileys) |
| Database | MongoDB via Prisma ORM |
| AI Provider | OpenAI, OpenRouter, Ollama, Other (OpenAI-compatible) |
| Web Search/Fetch | Firecrawl API |
| Media Download | nexo-aio-downloader, @tobyg74/tiktok-api-dl, yt-dlp (youtube-dl-exec) |
| Sticker Maker | wa-sticker-formatter, gallery-dl |
| Package Manager | pnpm |
| Container | Docker (multi-stage build) |

---

## 🏗️ Architecture Layers

```
src/
├── index.ts              # Entry point — CLI arg parsing, graceful shutdown, registerAllTools()
├── bot/
│   ├── botHandler.ts     # Core message processor — route, AI with tools, auto-download
│   └── autoDownload.ts   # Social media auto-download (regex-based, non-AI fallback)
├── config/
│   └── botConfig.ts      # Config loader (config.json > ENV > default)
├── database/
│   └── prisma.ts         # Prisma client singleton
├── libs/
│   └── baileys/
│       └── usePrismaAuthState.ts  # Baileys auth persistence ke MongoDB
├── plugins/
│   ├── pluginManager.ts  # Plugin loader & command dispatcher
│   ├── ai/               # !ai command — AI chat with function calling
│   ├── basic/            # !help, !ping, !reportbug, !status, !testbutton
│   ├── group/            # !hidetag, !setgroup, !togglebot
│   ├── media/            # !tiktok, !instagram, !facebook, !youtube, !pinterest,
│   │                     # !sticker, !toimg, !twitter, !gdlsticker
│   ├── owner/            # !eval, !exec, !speedtest
│   └── session/          # !create_session, !disconnect, !listsessions
├── services/
│   ├── aiService.ts      # AI provider abstraction — streaming, history, function calling
│   ├── aiModeHandler.ts  # AI mode toggle per user
│   ├── groupToggle.ts    # Group AI enable/disable
│   └── systemPrompt.ts   # System prompts (private & group) dengan dynamic date injection
├── session/
│   ├── sessionManager.ts # Singleton — session lifecycle, reconnect, QR
│   ├── sessionHelper.ts  # Bridge — SessionManager ↔ BotHandler
│   └── authStateDB.ts    # (deprecated)
├── tools/                # AI Tooling System — function calling untuk AI
│   ├── index.ts          # Barrel export + registerAllTools()
│   ├── toolRegistry.ts   # Central tool registry (singleton)
│   └── definitions/
│       ├── index.ts                # Re-export all definitions
│       ├── socialDownload.ts       # TikTok, Instagram, Facebook, Twitter/X
│       ├── downloadYoutube.ts      # YouTube video/audio download
│       ├── pinterestSearch.ts      # Pinterest image search
│       ├── galleryDlSticker.ts     # Sticker dari gallery-dl
│       ├── webFetch.ts             # Firecrawl web scraper
│       └── webSearch.ts            # Firecrawl web search
├── types/
│   ├── index.ts          # Re-export
│   ├── command.ts        # CommandContext, CommandConfig, CommandHandler
│   ├── plugin.ts         # Plugin, PluginModule, CategoryPlugin, CommandModule
│   ├── tools.ts          # AIToolDefinition, AIToolCall, ToolContext, dll
│   └── nexo-aio-downloader.d.ts
└── utils/
    ├── logger.ts              # Logging utility (level-based)
    ├── pinterest.ts           # Pinterest download helper (cheerio-based)
    ├── twitterDownloader.ts   # Twitter/X download via yt-dlp
    ├── galleryDlSticker.ts    # gallery-dl execution & sticker creation
    ├── toolCallFilter.ts      # DSML/XML tool call artifact filter
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

### 3. AI Multi-Provider + Function Calling
- [`AIService`](src/services/aiService.ts:19) mendukung **OpenAI-compatible**, **OpenRouter**, **Ollama**, dan **Other** (custom OpenAI-compatible).
- **Streaming response** via SSE (OpenAI/OpenRouter) atau JSON Lines (Ollama).
- **Function calling (tool use)**: [`chatWithTools()`](src/services/aiService.ts:179) mendukung multi-round tool execution.
- **Tool registry** ([`ToolRegistry`](src/tools/toolRegistry.ts:7)): Central registry untuk definisi dan eksekusi tools.
- **DSML parsing**: [`parseDsmlToolCalls()`](src/utils/toolCallFilter.ts:72) untuk model yang menulis tool call sebagai teks.
- **Tool artifact filter**: [`stripToolCallArtifacts()`](src/utils/toolCallFilter.ts:141) membersihkan artifact dari response.
- **Max 4 tool rounds** untuk mencegah infinite loop.

### 4. AI Tool Definitions (6 tools)
| Tool | Deskripsi | Backend |
|------|-----------|---------|
| `download_social_media` | Download TikTok, Instagram, Facebook, Twitter/X | nexo-aio-downloader, yt-dlp |
| `download_youtube` | Download YouTube video/audio | yt-dlp (youtube-dl-exec) |
| `pinterest_search` | Cari gambar di Pinterest | cheerio scraper |
| `gallery_dl_sticker` | Buat sticker dari URL galeri/kata kunci | gallery-dl + wa-sticker-formatter |
| `web_fetch` | Baca konten halaman web | Firecrawl API |
| `web_search` | Cari informasi di internet | Firecrawl API |

### 5. System Prompt Terpisah
- [`getSystemPrompt()`](src/services/systemPrompt.ts:16): Untuk AI mode private chat.
- [`getGroupSystemPrompt()`](src/services/systemPrompt.ts:116): Untuk group auto-reply, dengan personality system, time awareness, tool instructions.
- Dynamic date/time injection setiap prompt dipanggil.
- Anti-year-bias instruction untuk web search.

### 6. Message Processing Flow
1. `messages.upsert` event → `BotHandler.handleMessage()`
2. `simplified()` → Parse raw WAMessage ke objek terstruktur
3. `processMessage()` → Route: Command → Group Auto-Reply (AI) → AI Mode → Auto-Download → Button → Execute Command

### 7. Auth State Persistence
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

### Tool Development
- Definisikan di `src/tools/definitions/<name>.ts`.
- Export `definition` (AIToolDefinition) dan `execute` (ToolExecuteFunction).
- Daftarkan di [`src/tools/definitions/index.ts`](src/tools/definitions/index.ts).
- Tool execute function menerima `(args, context)` — context berisi `socket`, `fromJid`, `sessionId`.
- Tool bisa mengirim media langsung ke user via `context.socket.sendMessage()`.
- Tool harus return `ToolExecuteResult` (`{ success, message, data? }`).

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
| `AI_PROVIDER` | No | `openrouter` | `openai`, `openrouter`, `ollama`, or `other` |
| `OPENAI_API_KEY` | No | - | OpenAI API key |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | OpenAI base URL |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model |
| `OPENROUTER_API_KEY` | No | - | OpenRouter API key |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | OpenRouter base URL |
| `OPENROUTER_MODEL` | No | `anthropic/claude-3-haiku` | OpenRouter model |
| `OTHER_API_KEY` | No | - | Custom OpenAI-compatible API key |
| `OTHER_BASE_URL` | No | - | Custom OpenAI-compatible base URL |
| `OTHER_MODEL` | No | - | Custom model name |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | No | `llama3.2` | Ollama model |
| `FIRECRAWL_URL` | No | `https://api.firecrawl.dev` | Firecrawl API URL |
| `GALLERY_DL_BIN` | No | `gallery-dl` | gallery-dl binary path |
| `GALLERY_DL_TIMEOUT_MS` | No | `90000` | gallery-dl timeout |
| `GALLERY_DL_SEARCH_TEMPLATE` | No | Pinterest URL | Search template dengan `{query}` |
| `GALLERY_DL_COOKIES` | No | - | Path ke cookies.txt |
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
- Runtime dependencies: `python3`, `libvips`, `openssl`, `ffmpeg`, `tini`, `gallery-dl` (pip).
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
| `!testbutton` | Test interactive button | basic |
| `!ai <question>` | Ask AI with function calling | ai |
| `!ai on/off` | Toggle AI mode | ai |
| `!ai model <name>` | Change AI model (owner) | ai |
| `!ai models` | List available models | ai |
| `!ai clear` | Clear conversation history | ai |
| `!tiktok <url>` | Download TikTok | media |
| `!instagram <url>` | Download Instagram | media |
| `!youtube <url>` | Download YouTube | media |
| `!facebook <url>` | Download Facebook | media |
| `!twitter <url>` | Download Twitter/X | media |
| `!pinterest <query>` | Search Pinterest | media |
| `!sticker` | Make sticker from image | media |
| `!toimg` | Convert sticker to image | media |
| `!gdlsticker <url/query>` | Sticker from gallery-dl | media |
| `!hidetag` | Hidden tag all members | group |
| `!setgroup` | Group settings | group |
| `!togglebot` | Toggle bot in group | group |
| `!eval <code>` | Execute JS (owner) | owner |
| `!exec <cmd>` | Execute shell (owner) | owner |
| `!speedtest` | Internet speed test (owner) | owner |
| `!create_session` | Create new session | session |
| `!disconnect` | Disconnect session | session |
| `!listsessions` | List all sessions | session |

---

## 🧰 MCP Context-Mode

[`context-mode`](https://github.com/teknologi-umum/context-mode) adalah MCP server yang menyediakan **sandboxed code execution**, **persistent knowledge base**, dan **context optimization** untuk AI Agent.

### Installation Status

| Check | Status |
|-------|--------|
| Runtime | ✅ **Fast (Bun)** — JS/TS 3-5x lebih cepat |
| Storage Sessions | `~/.gemini/context-mode/sessions` |
| Version | `v1.0.162` |
| Hooks | ✅ BeforeTool, SessionStart, AfterTool, Precompress terpasang |

### Available Tools

| Tool | Fungsi |
|------|--------|
| [`ctx_execute`](#1-ctx_execute---sandboxed-code-execution) | Run code di sandbox (JS/TS/Python/Go/Shell) — hanya `console.log` yang masuk konteks |
| [`ctx_execute_file`](#2-ctx_execute_file---analisis-file-tanpa-baca-full) | Baca & proses file di sandbox tanpa memasukkan raw bytes ke konteks |
| [`ctx_index`](#3-ctx_index---persistent-knowledge-base) | Simpan dokumentasi/knowledge ke searchable FTS5 database |
| [`ctx_search`](#4-ctx_search---query-knowledge-base) | Cari indexed content dengan multi-strategy ranking (stemming + trigram) |
| [`ctx_fetch_and_index`](#5-ctx_fetch_and_index---fetch--index-url) | Fetch URL, convert ke markdown, auto-index ke knowledge base |
| [`ctx_batch_execute`](#6-ctx_batch_execute---batch-commands--auto-index) | Multiple commands dalam satu call, output auto-indexed |
| [`ctx_stats`](#7-ctx_stats---context-consumption-stats) | Lihat konsumsi konteks session saat ini |
| [`ctx_doctor`](#8-ctx_doctor---diagnostics) | Diagnostik instalasi context-mode |
| [`ctx_purge`](#9-ctx_purge---destructive-cleanup) | Hapus indexed content (destructive — gunakan hati-hati) |
| [`ctx_insight`](#10-ctx_insight---analytics-dashboard) | Dashboard analytics session di browser (port 4747) |

---

> **File ini diperuntukkan sebagai panduan konteks untuk AI Agent dan Developer.**
> Update sesuai dengan perubahan arsitektur dan konvensi project.
