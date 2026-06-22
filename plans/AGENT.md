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

### 1. `ctx_execute` — Sandboxed Code Execution

**Think-in-Code**: bytes yang diproses tidak pernah masuk conversation memory, hanya `console.log` yang masuk.

**Gunakan ketika:**
- Ingin derive answer dari data (filter, count, aggregate, parse, compare, transform)
- Output shape/size tidak bisa diprediksi sebelum eksekusi
- Ingin menghindari membaca raw log/file besar langsung ke konteks

```typescript
// Contoh: Analyze 47 source files tanpa membaca satupun
ctx_execute(language: "javascript", code: `
  const fs = require('fs');
  const files = fs.readdirSync('src').filter(f => f.endsWith('.ts'));
  files.forEach(f => {
    const lines = fs.readFileSync('src/'+f,'utf8').split('\\n').length;
    console.log(f + ': ' + lines + ' lines');
  });
`)
// Output: 47 files analyzed, 15,314 LoC — hanya ~3.6 KB masuk konteks
```

**Parameter penting:**
- `language`: `javascript`, `typescript`, `python`, `shell`, `go`, `ruby`, `rust`, `php`, `perl`, `r`, `elixir`, `csharp`
- `background: true` — untuk long-running process (dev server, watcher)
- `intent` — untuk output >5KB auto-index ke knowledge base, bisa di-search via `ctx_search`

---

### 2. `ctx_execute_file` — Analisis File Tanpa Baca Full

Baca file ke sandbox (`FILE_CONTENT` variable), proses dengan code, hanya hasil `console.log` yang masuk konteks.

```typescript
// Contoh: Cari error lines di log besar
ctx_execute_file(path: "huge.log", language: "javascript", code: `
  const errs = FILE_CONTENT.split('\\n').filter(l => /ERROR|FATAL/.test(l));
  console.log(errs.length + ' error lines');
  console.log(errs.slice(-5).join('\\n'));
`)
```

---

### 3. `ctx_index` — Persistent Knowledge Base

Simpan markdown/docs ke searchable FTS5 database. Menggunakan BM25 + trigram matching.

```typescript
// Index dari string langsung
ctx_index(content: "# React useEffect\n\nThe Effect Hook lets you ...", source: "react-useeffect-docs")

// Index dari file/directory
ctx_index(path: "/path/to/docs", source: "project-docs", include: ["*.md", "*.ts"])
```

**Source label** digunakan sebagai filter di `ctx_search`.

---

### 4. `ctx_search` — Query Knowledge Base

Multi-strategy ranking pipeline: Porter stemming + trigram-substring + proximity-rerank.

```typescript
// Batch query — multiple questions dalam satu call
ctx_search(queries: ["root cause", "proposed fix", "test coverage"], source: "issue-#683")

// Timeline mode — cari historical context
ctx_search(queries: ["what did we decide about caching"], source: "decision", sort: "timeline")

// Filter content type
ctx_search(queries: ["useEffect cleanup pattern"], contentType: "code")
```

**Content type filter:**
- `contentType: "code"` — surface implementation snippets
- `contentType: "prose"` — surface explanations

---

### 5. `ctx_fetch_and_index` — Fetch & Index URL

Fetch URL, convert HTML ke markdown, simpan di knowledge base. Raw bytes tidak masuk konteks.

```typescript
// Single URL
ctx_fetch_and_index(url: "https://react.dev/...", source: "react-docs")

// Batch parallel fetch (concurrency 2-8)
ctx_fetch_and_index(
  requests: [
    {url: "https://react.dev/...", source: "react"},
    {url: "https://vuejs.org/...", source: "vue"}
  ],
  concurrency: 5
)
```

**Caching**: 24 jam default, override via `ttl` parameter.

---

### 6. `ctx_batch_execute` — Batch Commands + Auto-Index

Multiple commands dalam satu call, output auto-indexed. Bisa langsung query hasilnya.

```typescript
ctx_batch_execute(
  commands: [
    {label: "Source Tree", command: "ls -la src/"},
    {label: "Package.json", command: "cat package.json"},
    {label: "Git Log", command: "git log --oneline -10"}
  ],
  queries: ["dependencies", "recent changes"],
  concurrency: 2   // Parallel I/O-bound commands
)
```

**Query scope:**
- `query_scope: "batch"` (default) — search only within this batch's output
- `query_scope: "global"` — search entire persistent knowledge base

---

### 7. `ctx_stats` — Context Consumption Stats

Lihat berapa banyak bytes yang sudah digunakan session ini, breakdown per tool, estimated token usage.

```typescript
ctx_stats()
```

---

### 8. `ctx_doctor` — Diagnostics

Cek instalasi context-mode lengkap. Gunakan jika ada masalah.

```typescript
ctx_doctor()
```

---

### 9. `ctx_purge` — Destructive Cleanup

Hapus indexed content. **Tidak bisa di-undo.**

```typescript
// Hapus session tertentu
ctx_purge(confirm: true, sessionId: "<uuid>")

// Hapus semua data project
ctx_purge(confirm: true, scope: "project")
```

---

### 10. `ctx_insight` — Analytics Dashboard

Buka dashboard analytics di browser untuk lihat session activity, tool usage, error rate, dll.

```typescript
ctx_insight()           // port 4747 default
ctx_insight(port: 5000) // custom port
```

---

### Best Practices

1. **Think-in-Code**: Daripada membaca file besar langsung, proses dulu di sandbox dan print summary-nya.
2. **Batch queries**: Kumpulkan multiple questions dalam satu `ctx_search` call.
3. **Index dokumentasi**: Simpan dokumentasi framework/library yang sering dipakai via `ctx_index`.
4. **Gunakan `intent`**: Untuk output besar, kasih `intent` supaya auto-indexed dan bisa di-search.
5. **Parallel fetch**: Untuk research multi-source, gunakan `ctx_fetch_and_index` dengan `concurrency: 4-8`.

---

> **File ini diperuntukkan sebagai panduan konteks untuk AI Agent dan Developer.**
> Update sesuai dengan perubahan arsitektur dan konvensi project.
