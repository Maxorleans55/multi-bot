# Bot-Baileys-AI — Dokumentasi Arsitektur Sistem

> **Versi:** 1.0.0  
> **Deskripsi:** Multi-session WhatsApp bot menggunakan Baileys, Prisma, dan MongoDB  
> **Bahasa:** TypeScript (ESM)

---

## Daftar Isi

1. [Tujuan & Konsep Dasar](#1-tujuan--konsep-dasar)
2. [Struktur Direktori](#2-struktur-direktori)
3. [Alur Startup](#3-alur-startup)
4. [Layer Arsitektur](#4-layer-arsitektur)
   - [4.1 Entry Point](#41-entry-point)
   - [4.2 Session Layer](#42-session-layer)
   - [4.3 Bot Layer](#43-bot-layer)
   - [4.4 Plugin System](#44-plugin-system)
   - [4.5 Service Layer](#45-service-layer)
   - [4.6 Database Layer](#46-database-layer)
   - [4.7 Configuration Layer](#47-configuration-layer)
   - [4.8 Utility Layer](#48-utility-layer)
5. [Alur Pesan](#5-alur-pesan)
6. [Sistem Plugin](#6-sistem-plugin)
7. [Multi-Session & Reconnect](#7-multi-session--reconnect)
8. [AI Integration](#8-ai-integration)
9. [Database Schema](#9-database-schema)
10. [Deployment](#10-deployment)
11. [Environment Variables](#11-environment-variables)

---

## 1. Tujuan & Konsep Dasar

Bot ini adalah **WhatsApp bot multi-session** yang memungkinkan:

- Menjalankan **banyak nomor WhatsApp** dalam satu instance Node.js
- Setiap session memiliki koneksi WebSocket sendiri ke WhatsApp
- **Plugin architecture** yang memisahkan command berdasarkan kategori
- **AI Chat** dengan dukungan multi-provider (OpenAI, OpenRouter, Ollama)
- **Auto-download** media sosial (TikTok, Instagram, Facebook, Twitter/X, YouTube)
- **Group management** dan fitur group AI
- **Persistent auth state** di MongoDB via Prisma

**Arsitektur mengikuti pola分层** yang terdiri dari:

```mermaid
flowchart TD
    A[Entry Point<br/>src/index.ts] --> B[SessionHelper]
    B --> C[SessionManager<br/>src/session/sessionManager.ts]
    C --> D[Membuat WASocket<br/>& mengatur reconnect]
    D --> E[BotHandler<br/>src/bot/botHandler.ts]
    E --> F[PluginManager<br/>src/plugins/pluginManager.ts]
    F --> G[Plugin Commands]
    E --> H[AIService<br/>src/services/aiService.ts]
    E --> I[AutoDownload<br/>src/bot/autoDownload.ts]
    C --> J[usePrismaAuthState<br/>src/libs/baileys/]
    J --> K[Prisma + MongoDB]
    H --> K
    G --> K
```

---

## 2. Struktur Direktori

```
Bot-Baileys-AI/
├── prisma/
│   └── schema.prisma              # Database schema (MongoDB)
│
├── scripts/
│   └── migrateAuthState.ts        # Migration script
│
├── src/
│   ├── index.ts                   # Entry point
│   │
│   ├── bot/
│   │   ├── botHandler.ts          # Core message processor
│   │   └── autoDownload.ts        # Social media auto-download
│   │
│   ├── config/
│   │   └── botConfig.ts           # Configuration loader
│   │
│   ├── database/
│   │   └── prisma.ts              # Prisma client singleton
│   │
│   ├── libs/
│   │   └── baileys/
│   │       └── usePrismaAuthState.ts  # Baileys auth persistence
│   │
│   ├── plugins/
│   │   ├── pluginManager.ts       # Plugin loader & dispatcher
│   │   ├── README.md
│   │   ├── ai/
│   │   │   └── aiCommand.ts       # AI command (!ai)
│   │   ├── basic/
│   │   │   ├── help.ts            # !help / !menu
│   │   │   ├── ping.ts            # !ping
│   │   │   ├── reportbug.ts       # !reportbug
│   │   │   ├── status.ts          # !status
│   │   │   └── testbutton.ts      # !testbutton
│   │   ├── group/
│   │   │   ├── hidetag.ts         # !hidetag
│   │   │   ├── setgroup.ts        # !setgroup
│   │   │   └── togglebot.ts       # !togglebot
│   │   ├── media/
│   │   │   ├── facebook.ts        # !facebook
│   │   │   ├── instagram.ts       # !instagram
│   │   │   ├── pinterest.ts       # !pinterest
│   │   │   ├── sticker.ts         # !sticker
│   │   │   ├── stickerToImage.ts  # !toimg
│   │   │   ├── tiktok.ts          # !tiktok / !tt
│   │   │   └── youtube.ts         # !youtube
│   │   ├── owner/
│   │   │   ├── eval.ts            # !eval
│   │   │   ├── exec.ts            # !exec
│   │   │   └── test_owner.ts      # Owner test
│   │   └── session/
│   │       ├── create_session.ts       # !create_session
│   │       ├── disconnect_session.ts   # !disconnect
│   │       └── list_sessions.ts        # !listsessions
│   │
│   ├── services/
│   │   ├── aiService.ts           # AI provider abstraction
│   │   ├── aiModeHandler.ts       # AI mode handler
│   │   └── groupToggle.ts         # Group AI toggle
│   │
│   ├── session/
│   │   ├── sessionManager.ts      # Singleton: session lifecycle
│   │   ├── sessionHelper.ts       # Bridge: session + bot handler
│   │   └── authStateDB.ts         # (deprecated/optional)
│   │
│   ├── types/
│   │   ├── index.ts               # Re-export
│   │   ├── command.ts             # CommandContext, CommandConfig, dll
│   │   ├── plugin.ts              # Plugin, PluginModule, CategoryPlugin
│   │   └── nexo-aio-downloader.d.ts  # Type declarations
│   │
│   └── utils/
│       ├── logger.ts              # Logging utility
│       ├── pinterest.ts           # Pinterest helper
│       └── youtubeButtonHandler.ts # YouTube button handler
│
├── config.json                    # Opsional: bot config file
├── .env.example                   # Environment variables template
├── package.json
├── tsconfig.json
├── prisma.config.ts
├── Dockerfile
└── pnpm-workspace.yaml
```

---

## 3. Alur Startup

```mermaid
sequenceDiagram
    participant U as User/CLI
    participant Entry as src/index.ts
    participant Helper as sessionHelper.ts
    participant SM as SessionManager
    participant PR as Prisma
    participant BH as BotHandler
    participant PM as PluginManager

    U->>Entry: node dist/index.js [--session=X] [--force-clear] [--only]
    
    Entry->>Entry: Load dotenv, validate DATABASE_URL
    Entry->>Entry: Parse CLI arguments
    
    alt --only mode
        Entry->>Entry: Skip DB sessions, run ONLY --session=X
        Entry->>Helper: createSession(sessionId, forceClear)
    else default mode
        Entry->>Helper: loadActiveSessions(forceClear)
        Helper->>SM: loadActiveSessions()
        SM->>PR: find waAuthState (creds)
        PR-->>SM: List of session IDs
        
        loop Each session
            SM->>SM: createSession(sessionId)
            SM->>SM: makeWASocket (Baileys)
            SM->>SM: Register event handlers
            SM->>Helper: triggerCallbacks(socket, sessionId)
            Helper->>BH: new BotHandler(socket, sessionId)
            BH->>PM: loadPlugins()
            PM->>PM: Discover & register commands
        end
        
        alt No active sessions
            Entry->>Helper: createSession('default')
        end
    end
    
    Note over Entry: Bot running, wait for Ctrl+C
    U->>Entry: SIGINT / SIGTERM
    Entry->>Helper: disconnectAllSessions()
    Helper->>SM: disconnectAllSessions()
    SM->>PR: Mark sessions inactive
```

---

## 4. Layer Arsitektur

### 4.1 Entry Point

**File:** [`src/index.ts`](src/index.ts:1)

Bertanggung jawab untuk:
- Memuat environment variables via `dotenv`
- Memvalidasi koneksi database
- Memproses CLI arguments (`--session`, `--force-clear`, `--only`)
- Memuat session aktif dari database atau membuat session baru
- Menangani graceful shutdown (SIGINT/SIGTERM)

**CLI Arguments:**
| Argument | Deskripsi |
|----------|-----------|
| `--session=<id>` | Buat/replace session dengan ID tertentu |
| `--force-clear` | Hapus auth data session yang ada |
| `--only` | Hanya jalankan session dari `--session`, skip session DB lain |

### 4.2 Session Layer

**File:** [`src/session/sessionManager.ts`](src/session/sessionManager.ts:26) | [`src/session/sessionHelper.ts`](src/session/sessionHelper.ts:1)

#### SessionManager (Singleton)

Class utama yang mengelola lifecycle session WhatsApp:

```mermaid
flowchart LR
    subgraph SessionManager
        direction TB
        S1[Session Map<br/>sessionId -> WASocket]
        R[Reconnect Attempts Map]
        C[Callbacks: onCreated, onDisconnected]
        G[Group Metadata Cache]
    end
    
    SM[SessionManager] --> |createSession| W[makeWASocket]
    W --> |connection.update| H{Connection State}
    H --> |qr| Q[QR Code Display]
    H --> |open| O[Connected!]
    H --> |close| Ck{Logged Out?}
    Ck --> |No| Re[Reconnect with backoff]
    Ck --> |Yes| End[Stop & cleanup]
```

**Fitur utama:**
- **Auto-reconnect:** Exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s) hingga 5 kali percobaan
- **Session callbacks:** `onSessionCreated()` dan `onSessionDisconnected()` untuk integrasi BotHandler
- **QR Code:** Ditampilkan di terminal via `qrcode-terminal`
- **Session filtering:** Environment variables `INCLUDE_SESSIONS` / `EXCLUDE_SESSIONS`
- **Persistence:** Session metadata disimpan ke `WaSession` model di MongoDB

#### SessionHelper (Bridge)

**File:** [`src/session/sessionHelper.ts`](src/session/sessionHelper.ts:1)

Menjembatani SessionManager dengan BotHandler:
- Mendaftarkan callback `onSessionCreated` → membuat BotHandler baru
- Mendaftarkan callback `onSessionDisconnected` → cleanup BotHandler
- Menyediakan public API: `createSession()`, `getSession()`, `getAllSessions()`, `disconnectSession()`, `disconnectAllSessions()`, `loadActiveSessions()`

### 4.3 Bot Layer

**File:** [`src/bot/botHandler.ts`](src/bot/botHandler.ts:35) | [`src/bot/autoDownload.ts`](src/bot/autoDownload.ts:1)

#### BotHandler

Class utama pemroses pesan. Menerima event dari `messages.upsert` dan memprosesnya.

**Fungsi `simplified()`** mengubah raw `WAMessage` dari Baileys menjadi objek yang lebih mudah digunakan, mengekstrak:
- Metadata pesan (from, fromMe, isGroup, type, dll)
- Teks pesan dan command parsing
- Prefix detection
- Button/Interactive message detection
- Type checks (isImage, isVideo, isAudio, dll)
- Quoted message info

**Fungsi `processMessage()`** — routing logika utama:

```mermaid
flowchart TD
    M[Message Received] --> S[simplified]
    S --> Check{isCmd?}
    
    Check --> |Yes| CMD[Execute Command<br/>via PluginManager]
    Check --> |No + Group| GRP{Group Auto-Reply?}
    Check --> |No + Private| AI{AI Mode On?}
    
    GRP --> |Bot mentioned/replied/called| GAI[AI Group Reply]
    GRP --> |No| END[End]
    
    AI --> |Yes| HAI[Handle AI Message]
    AI --> |No| SM{Social Link?}
    
    SM --> |Yes| D[Auto Download]
    SM --> |No| END
    
    CMD --> |Button| YT[YouTube Button Handler]
    CMD --> |Prefix| EX[Execute Command]
```

**Fitur yang ditangani:**
1. **Maintenance mode** — tolak command non-owner saat maintenance
2. **Group auto-reply** — AI merespon ketika bot di-mention, di-reply, atau dipanggil
3. **AI mode** — Percakapan AI di private chat
4. **Auto-download** — Deteksi otomatis link sosial media
5. **Button replies** — Handle interactive button responses (YouTube)
6. **Command execution** — via PluginManager

#### AutoDownload

**File:** [`src/bot/autoDownload.ts`](src/bot/autoDownload.ts:1)

Mendeteksi link sosial media via regex patterns dan mendownload konten:

| Platform | Regex Pattern | Downloader |
|----------|--------------|------------|
| Instagram | `instagram.com/p/`, `instagram.com/reel/` | `nexo-aio-downloader` |
| TikTok | `tiktok.com/@user/video/`, `vm.tiktok.com/` | `@tobyg74/tiktok-api-dl` |
| YouTube | `youtube.com/watch?v=`, `youtu.be/` | `nexo-aio-downloader` (partial) |
| Facebook | `facebook.com/`, `fb.watch/` | `nexo-aio-downloader` |
| Twitter/X | `twitter.com/.../status/`, `x.com/.../status/` | `nexo-aio-downloader` |

### 4.4 Plugin System

**File:** [`src/plugins/pluginManager.ts`](src/plugins/pluginManager.ts:13)

#### Arsitektur Plugin

```mermaid
flowchart LR
    subgraph PluginManager
        PM[PluginManager] --> |loadPlugins| Scan[Scan plugins directory]
        
        Scan --> |.ts file| Legacy[Legacy Plugin]
        Scan --> |folder| Category[Category Plugin]
        
        Legacy --> |export default| LP{PluginModule?}
        LP --> |Yes| Register[Register plugin & commands]
        
        Category --> |index.ts| CI[Load from index]
        Category --> |no index.ts| AD[Auto-discover .ts files]
        
        AD --> CM{CommandModule?}
        CM --> |Yes| Register
        
        Register --> Map[commandMap: Map<br/>name -> {plugin, config, handler}]
        Register --> Alias[aliasMap: Map<br/>alias -> commandName]
    end
    
    subgraph Execution
        E[executeCommand] --> Find{Find in commandMap}
        Find --> |Not found| AliasResolve{Resolve alias}
        AliasResolve --> |Found| Perm[Check permissions]
        
        Perm --> |ownerOnly| O{Is Owner?}
        Perm --> |adminOnly| A{Is Admin?}
        Perm --> |groupOnly| G{Is Group?}
        Perm --> |privateOnly| P{Is Private?}
        
        O --> |No| Reject[Reject]
        A --> |No| Reject
        G --> |No| Reject
        P --> |No| Reject
        
        O --> |Yes| Exec[Execute handler]
        A --> |Yes| Exec
        G --> |Yes| Exec
        P --> |Yes| Exec
    end
```

#### Format Plugin

**Legacy Plugin (PluginModule):**
```typescript
export default {
  name: 'myPlugin',
  version: '1.0.0',
  description: 'Plugin saya',
  commands: [
    { name: 'mycmd', description: '...', usage: '...', category: '...' }
  ],
  handlers: {
    mycmd: async (context, args) => { ... }
  },
  onLoad() { ... },
  onUnload() { ... },
};
```

**Category Plugin (CommandModule per file):**
```typescript
// src/plugins/media/tiktok.ts
export default {
  config: { name: 'tiktok', ... },
  handler: async (context, args) => { ... },
};
```

#### Permission System

PluginManager mengecek permission berdasarkan field di `CommandConfig`:
- `ownerOnly` — hanya nomor owner yang tercantum di config
- `adminOnly` — hanya admin grup (atau owner)
- `groupOnly` — hanya bisa digunakan di grup
- `privateOnly` — hanya bisa digunakan di private chat

#### CommandContext

Setiap handler menerima [`CommandContext`](src/types/command.ts:4):
```typescript
interface CommandContext {
  socket: WASocket;          // Koneksi WebSocket aktif
  sessionId: string;         // ID session saat ini
  fromJid: string;           // JID pengirim
  fromMe: boolean;           // Dari bot sendiri?
  pushName?: string;         // Nama pengirim
  messageTimestamp?: number; // Timestamp pesan
  message: WAMessage;        // Raw Baileys message
  simplified?: SimplifiedMessage; // Simplified message object
  pluginManager?: any;       // PluginManager instance
}
```

### 4.5 Service Layer

#### AI Service

**File:** [`src/services/aiService.ts`](src/services/aiService.ts:19)

Singleton yang menyediakan abstraksi AI multi-provider:

```mermaid
flowchart TD
    subgraph AIService
        direction TB
        Init[Constructor] --> P{Provider?}
        P --> |openai| OAI[OpenAI-compatible API]
        P --> |openrouter| OR[OpenRouter API]
        P --> |ollama| OL[Ollama API]
        
        OAI --> S1[Streaming via SSE]
        OR --> S1
        OL --> S2[Streaming via JSON Lines]
    end
    
    subgraph Features
        CH[Conversation History<br/>Map: sessionId -> ChatMessage[]]
        CE[Conversation Expiry<br/>10 menit untuk grup]
        MC[Multi-Provider<br/>OpenAI, OpenRouter, Ollama]
    end
    
    App[BotHandler / aiCommand] --> |chat/chatStream| AIService
```

**Provider Configuration:**
| Provider | API Key | Base URL | Model Default |
|----------|---------|----------|---------------|
| openai | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `gpt-4o-mini` |
| openrouter | `OPENROUTER_API_KEY` | `OPENROUTER_BASE_URL` | `anthropic/claude-3-haiku` |
| ollama | - | `OLLAMA_BASE_URL` | `llama3.2` |

Fitur OpenRouter spesifik: tools `openrouter:datetime` dan `openrouter:web_search` untuk akses real-time.

#### AI Mode Handler

**File:** [`src/services/aiModeHandler.ts`](src/services/aiModeHandler.ts:33)

Menyediakan mode AI chat (toggle `on`/`off`) per user dengan:
- Context history management
- Max history 20 messages
- Single atau chat mode

#### Group Toggle

**File:** [`src/services/groupToggle.ts`](src/services/groupToggle.ts:1)

Mengelola pengaturan AI per grup. Disabled groups disimpan di MongoDB via model `BotConfig`.

### 4.6 Database Layer

**File:** [`src/database/prisma.ts`](src/database/prisma.ts:1) | [`prisma/schema.prisma`](prisma/schema.prisma:1)

**Database:** MongoDB via Prisma ORM

**Models:**

```mermaid
erDiagram
    WaSession ||--o{ WaAuthState : has
    WaSession {
        string id PK
        string sessionId UK
        string phoneNumber
        string status
        boolean isActive
        datetime lastConnectedAt
        datetime lastDisconnectedAt
        datetime lastQrAt
    }
    
    WaAuthState {
        string id PK
        string sessionId FK
        string type
        string key
        json value
    }
    
    BotConfig {
        string id PK
        string key UK
        string value
    }
    
    Session ||--o{ Message : has
    Session {
        string id PK
        string sessionId UK
        string phoneNumber
        boolean isActive
        json authData
    }
    
    Message {
        string id PK
        string sessionId FK
        json key
        json message
        bigint messageTimestamp
        boolean fromMe
        string pushName
    }
```

**Auth State Persistence:**

[`usePrismaAuthState`](src/libs/baileys/usePrismaAuthState.ts:67) mengimplementasikan interface `AuthenticationState` Baileys untuk menyimpan credential dan key di MongoDB:
- `creds` disimpan sebagai satu baris dengan type=`creds`, key=`creds`
- `keys` disimpan per-item dengan type=`<keyType>`, key=`<id>`
- Compound unique constraint pada `(sessionId, type, key)` untuk upsert

### 4.7 Configuration Layer

**File:** [`src/config/botConfig.ts`](src/config/botConfig.ts:1)

Priority loading: `config.json` > Environment Variables > Default Values

| Config | File | Env | Default |
|--------|------|-----|---------|
| Owner Numbers | `ownerNumbers` | `OWNER_NUMBERS` | `[]` |
| Prefixes | `prefixes` | `PREFIXES` | `['!']` |
| Maintenance | `maintenance` | `MAINTENANCE` | `false` |
| Maintenance Message | `maintenanceMessage` | `MAINTENANCE_MESSAGE` | "🔧 Bot sedang..." |

### 4.8 Utility Layer

- **Logger** ([`src/utils/logger.ts`](src/utils/logger.ts:1)): Simple logger dengan level (silent, error, warn, info, debug) dan emoji support
- **YouTube Button Handler** ([`src/utils/youtubeButtonHandler.ts`](src/utils/youtubeButtonHandler.ts)): Handle interactive button untuk YouTube download
- **Pinterest Helper** ([`src/utils/pinterest.ts`](src/utils/pinterest.ts)): Pinterest download utility

---

## 5. Alur Pesan

Flow lengkap dari pesan masuk hingga response:

```mermaid
sequenceDiagram
    participant WA as WhatsApp
    participant SM as SessionManager
    participant BH as BotHandler
    participant PM as PluginManager
    participant AI as AIService
    participant AD as AutoDownload
    
    WA->>SM: messages.upsert {type: notify}
    SM->>BH: Message event
    
    BH->>BH: simplified() - Parse message
    BH->>BH: printLog() - Console log
    
    BH->>BH: processMessage()
    
    alt Maintenance Mode + Not Owner
        BH->>WA: Send maintenance message
    end
    
    alt Group + Not Command
        BH->>BH: Check bot mentioned/replied?
        BH->>AI: Group auto-reply
        AI->>BH: AI response
        BH->>WA: Send quoted reply
    end
    
    alt Private + AI Mode On
        BH->>AI: handleAIMessage
        AI->>BH: AI response
        BH->>WA: Send reply
    end
    
    alt Social Media Link Detected
        BH->>AD: downloadFromSocialMedia
        AD->>AD: Detect platform
        AD->>AD: Download & send media
        AD->>WA: Send video/image
    end
    
    alt Button Reply
        BH->>BH: handleYouTubeButton
    end
    
    alt Command
        BH->>PM: executeCommand(name, context, args)
        PM->>PM: Resolve alias
        PM->>PM: Check permissions
        PM->>PM: Execute handler
        PM->>WA: Send response
    end
```

---

## 6. Sistem Plugin

### Discovery & Loading

PluginManager melakukan **auto-discovery** dari direktori `src/plugins/`:

1. **File langsung** (`.ts`/`.js`) di root plugins → Legacy Plugin (PluginModule)
2. **Folder** di root plugins → Category Plugin:
   - Jika ada `index.ts` → load sebagai CategoryPlugin
   - Jika tidak ada → auto-discover semua file `.ts` dalam folder sebagai CommandModule

### Command Registration

Setiap command didaftarkan ke:
- `commandMap`: `Map<commandName, { plugin, config, handler }>`
- `aliasMap`: `Map<alias, commandName>`

### Plugin Categories

| Category | Path | Commands |
|----------|------|----------|
| `ai` | `src/plugins/ai/` | `!ai` |
| `basic` | `src/plugins/basic/` | `!help`, `!ping`, `!reportbug`, `!status`, `!testbutton` |
| `group` | `src/plugins/group/` | `!hidetag`, `!setgroup`, `!togglebot` |
| `media` | `src/plugins/media/` | `!tiktok`, `!instagram`, `!facebook`, `!youtube`, `!pinterest`, `!sticker`, `!toimg` |
| `owner` | `src/plugins/owner/` | `!eval`, `!exec`, (owner test) |
| `session` | `src/plugins/session/` | `!create_session`, `!disconnect`, `!listsessions` |

---

## 7. Multi-Session & Reconnect

### Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Creating: makeWASocket
    
    Creating --> QR: QR Code received
    Creating --> Connecting: Auth credentials exist
    
    QR --> Connecting: QR scanned
    
    Connecting --> Connected: Connection open
    Connecting --> Failed: Timeout / Error
    
    Connected --> Connected: Auto-reconnect on close
    Connected --> LoggedOut: Logged out
    
    Failed --> Creating: Retry (max 5x)
    
    LoggedOut --> [*]
```

### Reconnection Logic

Di [`SessionManager.registerMessageHandlers()`](src/session/sessionManager.ts:147):

1. Koneksi terputus (`connection === 'close'`)
2. Cek apakah `loggedOut`
3. Jika tidak logged out → reconnect dengan exponential backoff
4. Max 5 attempts, delay: 1s → 2s → 4s → 8s → 16s (max 30s)
5. Jika max attempts tercapai → session dihapus

### Graceful Shutdown

```typescript
// src/index.ts
process.on('SIGINT', async () => {
  await disconnectAllSessions(); // socket.end() - tanpa logout
  await prisma.$disconnect();
  process.exit(0);
});
```

`disconnectAllSessions()` menggunakan `socket.end()` (bukan `socket.logout()`) agar auth data tetap tersimpan untuk sesi berikutnya.

---

## 8. AI Integration

### Provider Support

```mermaid
flowchart TD
    subgraph AI Providers
        OAI[OpenAI-Compatible]
        OR[OpenRouter]
        OL[Ollama]
    end
    
    subgraph Features
        S[Streaming Response]
        H[Conversation History]
        M[Multi-Model Switching]
        T[OpenRouter Tools:<br/>datetime, web_search]
    end
    
    OAI --> S
    OR --> S
    OR --> T
    OL --> S
```

### AI Chat Flow

1. **Command Mode** (`!ai <question>`): Single question → streaming response via AI
2. **Toggle Mode** (`!ai on`): Semua pesan di private chat otomatis direspon AI
3. **Group Auto-Reply**: Bot di-mention/di-reply/dipanggil → AI merespon di grup

### System Prompts

- **Private AI:** Friendly, helpful, tidak membantu coding
- **Group AI:** Casual, pake bahasa Indonesia gaul, personality chameleon, strict time awareness, anti-robotic

### Conversation History

- Disimpan per `sessionId` (user JID untuk private, group JID untuk grup)
- Grup: expiry 10 menit
- Command `!ai clear` untuk menghapus history

---

## 9. Database Schema

### Model: WaSession

Menyimpan metadata session WhatsApp. Terpisah dari auth state.

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | String (unique) | ID session |
| `phoneNumber` | String? | Nomor telepon |
| `status` | String | `disconnected`, `qr`, `connected`, `logged_out` |
| `isActive` | Boolean | Status aktif |
| `lastConnectedAt` | DateTime? | Terakhir connect |
| `lastDisconnectedAt` | DateTime? | Terakhir disconnect |
| `lastQrAt` | DateTime? | Terakhir QR code |

### Model: WaAuthState

Menyimpan Baileys auth credentials dan keys.

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | String | FK ke WaSession |
| `type` | String | `creds` atau tipe key Baileys |
| `key` | String | Key identifier |
| `value` | Json | Value (via BufferJSON) |

**Unique:** `(sessionId, type, key)` — memungkinkan upsert.

### Model: BotConfig

Simple key-value store untuk konfigurasi dinamis.

| Field | Type | Description |
|-------|------|-------------|
| `key` | String (unique) | Key (e.g., `ai_group_disabled:jid`) |
| `value` | String | Value |

### Model: Session & Message

Legacy models (sudah ada tapi tidak aktif digunakan untuk message storage).

---

## 10. Deployment

### Docker

**File:** [`Dockerfile`](Dockerfile:1)

Multi-stage build:
1. **Builder stage** (`node:20-bookworm`): Install dependencies, build TypeScript
2. **Runtime stage** (`node:20-bookworm-slim`): Hanya runtime dependencies + compiled output

**Runtime dependencies:** `python3`, `libvips`, `openssl`, `ffmpeg`, `tini`

**Environment defaults:**
- `NODE_ENV=production`
- `EXCLUDE_SESSIONS=dev` (skip dev session di production)

### Docker Compose (recommended)

```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:7
    volumes:
      - mongo_data:/data/db
  
  bot:
    build: .
    env_file: .env
    depends_on:
      - mongodb
    environment:
      - DATABASE_URL=mongodb://mongodb:27017/bot_baileys
    # Override untuk development:
    # command: npm run start:dev
    # environment:
    #   - EXCLUDE_SESSIONS=
```

---

## 11. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Yes** | MongoDB connection string |
| `OWNER_NUMBERS` | No | Owner WhatsApp numbers (comma-separated) |
| `PREFIXES` | No | Command prefixes (default: `!`) |
| `AI_PROVIDER` | No | `openai`, `openrouter`, or `ollama` |
| `OPENAI_BASE_URL` | No | OpenAI-compatible API URL |
| `OPENAI_API_KEY` | No | OpenAI API key |
| `OPENAI_MODEL` | No | Model name |
| `OPENROUTER_API_KEY` | No | OpenRouter API key |
| `OPENROUTER_BASE_URL` | No | OpenRouter base URL |
| `OPENROUTER_MODEL` | No | OpenRouter model |
| `OLLAMA_BASE_URL` | No | Ollama server URL |
| `OLLAMA_MODEL` | No | Ollama model |
| `INCLUDE_SESSIONS` | No | Session IDs to load (comma-separated) |
| `EXCLUDE_SESSIONS` | No | Session IDs to skip (comma-separated) |
| `LOG_LEVEL` | No | Log level: `silent`, `error`, `warn`, `info`, `debug` |
| `NODE_ENV` | No | `development` or `production` |
| `MAINTENANCE` | No | Enable maintenance mode (`true`) |
| `MAINTENANCE_MESSAGE` | No | Custom maintenance message |

---

## Diagram Arsitektur Lengkap

```mermaid
flowchart TD
    subgraph External
        WA[WhatsApp Servers]
        AI_API[AI API Providers<br/>OpenAI / OpenRouter / Ollama]
        MONGO[MongoDB]
    end
    
    subgraph "Application Core"
        ENTRY[src/index.ts]
        SM[SessionManager]
        SH[SessionHelper]
        BH[BotHandler]
    end
    
    subgraph "Plugins"
        PM[PluginManager]
        AI[AI Commands]
        BASIC[Basic Commands]
        GROUP[Group Commands]
        MEDIA[Media Commands]
        OWNER[Owner Commands]
        SESSION[Session Commands]
    end
    
    subgraph "Services"
        AIS[AIService]
        AMH[AIModeHandler]
        GT[GroupToggle]
        AD[AutoDownload]
    end
    
    subgraph "Database Layer"
        PR[Prisma Client]
        APS[usePrismaAuthState]
    end
    
    subgraph "Config & Utils"
        CFG[botConfig]
        LOG[Logger]
        YT[YouTube Button Handler]
    end
    
    WA <-->|WebSocket| SM
    ENTRY --> SH
    ENTRY --> SM
    SH --> BH
    SM --> BH
    BH --> PM
    BH --> AIS
    BH --> AD
    BH --> CFG
    PM --> AI
    PM --> BASIC
    PM --> GROUP
    PM --> MEDIA
    PM --> OWNER
    PM --> SESSION
    AIS --> AI_API
    AD --> AI_API
    SM --> APS
    APS --> PR
    AIS --> PR
    GT --> PR
    PR --> MONGO
    YT --> BH
    LOG --> SM
    LOG --> PM
```

---

> **Dokumentasi ini dibuat pada:** 17 Juni 2026  
> **Maintainer:** Tim Bot-Baileys-AI
