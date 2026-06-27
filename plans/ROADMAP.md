# Bot-Baileys-AI — ROADMAP.md

> Strategic roadmap for project development.
> **Versi:** 1.1.0 | **Last Updated:** 25 Juni 2026

---

## 🎯 Vision

Menjadi **WhatsApp bot open-source yang paling powerful, extensible, dan mudah digunakan** dengan ecosystem plugin yang kaya, AI multi-provider, function calling, dan arsitektur yang scalable untuk multi-session.

---

## 🗺️ Strategic Roadmap

```mermaid
timeline
    title Bot-Baileys-AI Roadmap 2026

    section Q2 2026 (Done)
        Core Stabilization : Session management
                           : Plugin system
                           : AI multi-provider
                           : Auto-download media
                           : Docker deployment

    section Q3 2026 (Current)
        v1.1.x Release      : AI function calling (6 tools)
                           : Firecrawl web search & fetch
                           : gallery-dl sticker maker
                           : Twitter/X download via yt-dlp
                           : Dynamic date injection
                           : DSML tool call recovery

    section Q4 2026
        Infrastructure      : Structured logging
                           : Metrics & monitoring
                           : CI/CD pipeline
                           : Unit & integration tests
                           : Performance optimization
                           : Plugin hot reload

    section Q1 2027
        Advanced Features   : RAG & knowledge base
                           : Multi-language support
                           : Plugin marketplace
                           : Security audit
                           : v2.0 Release
```

---

## 🏁 Current Milestone: v1.1.x Feature Enhancement

**Status:** 🟢 On Track | **Progress:** ~85%

### Completed ✅
- [x] Multi-session management dengan reconnect logic
- [x] Plugin system dengan auto-discovery
- [x] Auth state persistence ke MongoDB
- [x] AI multi-provider (OpenAI, OpenRouter, Ollama, Other)
- [x] Social media auto-download (Instagram, TikTok, Facebook, Twitter/X, YouTube)
- [x] Group AI reply dengan personality system
- [x] Docker multi-stage build
- [x] Graceful shutdown handling
- [x] Session filtering (INCLUDE/EXCLUDE)
- [x] CLI argument parsing (--session, --force-clear, --only)
- [x] **AI Function Calling System** — 6 tools via ToolRegistry singleton
- [x] **Firecrawl Web Search & Fetch** — Ganti SearXNG dengan Firecrawl API
- [x] **gallery-dl Sticker Tool** — Buat stiker dari URL atau keyword pencarian
- [x] **Twitter/X Download** — Implementasi via yt-dlp (youtube-dl-exec)
- [x] **System Prompt Refactor** — Extract ke `systemPrompt.ts`, dynamic date injection
- [x] **AI Date/Time Awareness** — Inject real-time date ke prompt, anti-year-bias
- [x] **Group Prompt Enhancement** — Tool instructions, time roasting, banter system
- [x] **DSML Tool Call Recovery** — Parse DSML/XML artifacts dari model tanpa native function calling
- [x] **Tool Call Artifact Filter** — Strip residual artifacts dari respons AI
- [x] **'other' AI Provider** — Dukungan untuk custom OpenAI-compatible API
- [x] **gallery-dl !gdlsticker command** — Plugin command untuk sticker maker
- [x] **!toimg command** — Konversi stiker ke gambar
- [x] **!twitter command** — Twitter/X media download
- [x] **!speedtest command** — Owner speed test utility
- [x] **!changelog command** — Lihat riwayat perubahan

### In Progress 🔄
- [ ] YouTube full download support (playlist, quality selection)
- [ ] Rate limiting implementation
- [ ] Comprehensive error recovery

### Up Next 📋
1. **YouTube Complete** — Full YouTube download dengan format/quality selection
2. **Rate Limiting** — Implement cooldown system per command/user
3. **Error Boundaries** — Improve error handling di setiap layer agar tidak crash session lain
4. **Structured Logging** — JSON logging untuk production debugging

---

## 🎨 Upcoming Features: Q4 2026

### Infrastructure & DevOps
- **Structured Logging** — JSON format logs untuk ELK/Grafana
- **Metrics Dashboard** — Grafana dashboard untuk session health
- **Health Endpoint** — HTTP health check untuk container orchestration
- **Performance Profiling** — Identify bottlenecks regularly

### Testing
- **Unit Tests** — Jest/Vitest untuk core modules
- **Integration Tests** — Mock WhatsApp WebSocket
- **E2E Tests** — Full flow testing
- **Load Testing** — K6/similar untuk performance benchmarking

### CI/CD
- **GitHub Actions** — Automated type-check, lint, build, test
- **Automated Releases** — Semantic release with changelog
- **Docker Registry** — Automated Docker image push
- **Deployment Scripts** — One-command deploy

### Performance Optimization
- **Query Optimization** — Database query profiling
- **Caching Layer** — Redis for session & message cache
- **Memory Profiling** — Reduce memory footprint per session
- **Connection Pooling** — Optimize MongoDB connections

### Plugin System
- **Plugin Hot Reload** — Reload plugins without restart
- **Plugin Dependencies** — Declare & resolve plugin dependencies
- **Plugin Registry** — Central registry untuk plugin yang terinstall

---

## 🚀 Advanced Features: Q1 2027 (v2.0)

### AI Platform
- **RAG System** — Chat with documents (PDF, text, web pages)
- **Knowledge Base** — Persistent knowledge base per user/group
- **More AI Tools** — Weather, calendar, calculators, etc.
- **Multi-Modal** — Full image, audio, video processing

### Ecosystem
- **Plugin Marketplace** — Registry for community plugins
- **Plugin SDK** — SDK for third-party plugin developers
- **Template System** — Project templates for new plugins
- **API Access** — REST API for external integrations

### Enterprise Features
- **Multi-Tenant** — Isolated environments per tenant
- **Audit Logging** — Complete action audit trail
- **Role-Based Access** — Granular permission system
- **Backup & Disaster Recovery** — Automated backup strategies

### Community & Documentation
- **Website/Docs** — Documentation website with examples
- **Tutorial Series** — Video/written tutorials
- **Contributor Guide** — Clear contribution guidelines
- **Community Templates** — Ready-to-use bot templates

---

## 📊 Key Metrics

| Metric | Current | Target Q4 2026 | Target v1.1.x | Target v2.0 |
|--------|---------|----------------|---------------|-------------|
| **Commands** | 25+ | 30+ | 35+ | 50+ |
| **AI Providers** | 4 | 4 | 5 | 5+ |
| **AI Tools** | 6 | 8+ | 10+ | 15+ |
| **Media Platforms** | 5 | 7 | 7 | 10+ |
| **Test Coverage** | 3 unit tests | 20% | 40% | 85%+ |
| **GitHub Stars** | - | 50+ | 100+ | 500+ |
| **Contributors** | 1 | 3+ | 5+ | 15+ |

---

## 🧪 Experimental / Research

Teknologi yang sedang dieksplorasi untuk future release:

- [ ] **WebSocket Gateway** — Bot bisa diakses via WebSocket API
- [ ] **Database Migration** — PostgreSQL as optional database (via Prisma)
- [ ] **Serverless Support** — Deploy bot sebagai serverless function
- [ ] **Desktop App** — Electron-based desktop manager untuk bot
- [ ] **Mobile Companion** — Mobile app untuk monitoring bot

---

## 🤝 Contribution Guide

Kami menyambut kontribusi dari siapa pun! Berikut cara berkontribusi:

1. **Fork** repository ini
2. Buat **feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit** perubahan (`git commit -m 'feat: add amazing feature'`)
4. **Push** ke branch (`git push origin feature/amazing-feature`)
5. Buka **Pull Request**

### Development Setup
```bash
# Clone repo
git clone https://github.com/yourusername/Bot-Baileys-AI.git
cd Bot-Baileys-AI

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Setup database
pnpm prisma:generate
pnpm prisma:migrate

# Run
pnpm dev
```

### Coding Standards
- Ikuti konvensi yang tercantum di [`AGENT.md`](AGENT.md)
- Gunakan TypeScript strict mode
- Tulis test untuk fitur baru (target: 85% coverage)
- Dokumentasikan plugin dan command baru
- Gunakan semantic commit messages (`feat:`, `fix:`, `docs:`, `refactor:`, dll)

---

## 📅 Release Timeline

| Version | Date | Focus |
|---------|------|-------|
| v1.0.0-alpha | Q2 2026 | Core functionality |
| v1.0.0-beta | Q2 2026 | Stabilization & bug fixes |
| v1.0.0 | Q3 2026 | First stable release |
| v1.1.0 | Q3 2026 | AI function calling, Firecrawl, gallery-dl, DSML |
| v1.2.0 | Q4 2026 | Infrastructure & testing |
| v2.0.0 | Q1 2027 | Advanced features & ecosystem |

---

> **Disclaimer:** Roadmap ini bersifat dinamis dan dapat berubah sesuai dengan prioritas project dan feedback dari komunitas.
>
> **Maintainer:** Tim Bot-Baileys-AI
