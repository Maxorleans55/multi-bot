# Bot-Baileys-AI — TODO.md

> Task list dan development roadmap.
> **Versi:** 1.0.0 | **Last Updated:** 17 Juni 2026

---

## 📋 Phase 1: Core Stabilization

- [x] **Session Management** — Multi-session dengan reconnect exponential backoff
- [x] **Plugin System** — Auto-discovery dengan dua mode (Legacy & Category)
- [x] **Auth Persistence** — Baileys auth state ke MongoDB via Prisma
- [x] **AI Service** — Multi-provider dengan streaming response
- [x] **Auto-Download** — Social media download (IG, TikTok, FB, Twitter, YT)
- [x] **Group AI Reply** — Bot merespon di grup ketika di-mention/di-reply
- [x] **Docker Support** — Multi-stage build dengan runtime minimal
- [x] **Graceful Shutdown** — SIGINT/SIGTERM handling, disconnect sessions
- [ ] **Comprehensive Error Recovery** — Improve error boundaries di semua layer
- [ ] **Message Validation** — Validate incoming messages before processing
- [ ] **Rate Limiting** — Implement cooldown per command per user

## 📋 Phase 2: Feature Enhancements

### AI & Chat
- [ ] **AI Image Analysis** — Kirim gambar ke AI untuk dianalisis (vision)
- [ ] **AI Voice Notes** — Transcribe dan proses voice notes dengan AI
- [ ] **Custom System Prompt per User** — User bisa set system prompt sendiri
- [ ] **AI Personality Presets** — Multiple personality templates
- [ ] **Web Search Integration** — Integrasi web search untuk AI (selain OpenRouter tools)
- [ ] **Conversation Export** — Export riwayat chat AI

### Media Download
- [ ] **YouTube Auto-Download** — Implementasi full YouTube download (saat ini partial)
- [ ] **YouTube Playlist Support** — Download playlist YouTube
- [ ] **Twitter/X Thread Download** — Download entire thread
- [ ] **Multi-Platform Downloader** — Tambah support platform lain (Reddit, Pinterest direct)
- [ ] **Media Queue System** — Antrian download untuk menghindari rate limit
- [ ] **Compression Options** — Opsi kompresi untuk video besar

### Group Management
- [ ] **Welcome/Goodbye Messages** — Customizable welcome & goodbye
- [ ] **Anti-Link / Anti-Spam** — Auto-remove link/spam dari group
- [ ] **Scheduled Messages** — Jadwalkan pesan di group
- [ ] **Poll & Voting** — Fitur polling/voting
- [ ] **Leveling System** — User levels & XP di group

### Plugin System
- [ ] **Hot Reload** — Reload plugin tanpa restart bot
- [ ] **Plugin Dependencies** — Declare & resolve plugin dependencies
- [ ] **Plugin Registry** — Central registry untuk plugin yang terinstall
- [ ] **Plugin Config Per-Session** — Konfigurasi plugin berbeda per session
- [ ] **Plugin API Documentation** — Auto-generate docs dari plugin metadata

## 📋 Phase 3: Infrastructure & DevOps

### Monitoring & Observability
- [ ] **Structured Logging** — JSON logging untuk production
- [ ] **Metrics Dashboard** — Session health, message throughput, error rates
- [ ] **Health Check Endpoint** — HTTP health check untuk Docker/k8s
- [ ] **Performance Profiling** — Identify bottlenecks (message processing, AI calls)
- [ ] **Error Tracking** — Integrasi Sentry atau error tracking service

### Database & Performance
- [ ] **Database Indexing** — Optimasi query performance
- [ ] **Message Caching** — Cache WAMessage untuk mengurangi DB reads
- [ ] **Connection Pooling** — Optimasi koneksi MongoDB
- [ ] **Data Cleanup** — Auto-cleanup expired sessions & old messages
- [ ] **Migration Script Enhancement** — Improve migration scripts

### CI/CD
- [ ] **GitHub Actions** — CI pipeline (type-check, lint, build)
- [ ] **Automated Testing** — Unit tests untuk core modules
- [ ] **Integration Tests** — End-to-end testing dengan mock WhatsApp
- [ ] **Automated Deployment** — Deploy ke server via CI/CD
- [ ] **Docker Compose Production** — Production-grade docker-compose.yml

## 📋 Phase 4: Advanced Features

### Security & Reliability
- [ ] **Session Isolation** — Isolasi error antar session
- [ ] **Message Queue** — Antrian pesan untuk menghindari overload
- [ ] **Backup & Restore** — Backup auth state & config
- [ ] **Rate Limit per Session** — Prevent abuse per session
- [ ] **IP Whitelist** — Untuk owner-only endpoints

### User Experience
- [ ] **Interactive Menu** — Button-based menu system
- [ ] **Multi-Language Support** — i18n untuk commands
- [ ] **User Preferences** — Persistent user settings
- [ ] **Command Suggestions** — Auto-suggest commands saat typo
- [ ] **Media Gallery** — List & manage downloaded media

### Advanced AI
- [ ] **RAG (Retrieval-Augmented Generation)** — Chat dengan dokumen/knowledge base
- [ ] **Multi-Modal AI** — Process images, audio, video
- [ ] **AI Agent Tools** — Function calling untuk actions (cek cuaca, jadwal, dll)
- [ ] **Context-Aware Conversations** — Remember user context across sessions
- [ ] **AI Training/Finetuning** — Custom model fine-tuning

## 🐛 Known Issues

| Issue | Status | Priority | Notes |
|-------|--------|----------|-------|
| YouTube auto-download tidak fully implemented | 🟡 Open | Medium | Hanya fallback ke command manual |
| Message saving ke DB di-comment out | 🟡 Open | Low | Perlu diaktifkan jika diperlukan |
| Some type safety issues dengan Baileys types | 🟡 Open | Medium | Perlu deklarasi tipe yang lebih ketat |
| Tidak ada rate limiting | 🟡 Open | High | Bisa menyebabkan spam |
| Plugin hot reload belum support | 🟡 Open | Low | Butuh restart untuk reload plugin |
| Group metadata cache TTL 5 menit | 🟡 Open | Low | Konfigurasikan sesuai kebutuhan |

## 📈 Performance Goals

- **Message Processing Latency**: < 500ms (non-AI)
- **AI Response Time**: < 5s (first token)
- **Session Reconnect**: < 30s (max)
- **Plugin Load Time**: < 2s (all plugins)
- **Memory Usage**: < 200MB per session
- **Uptime**: 99.9% (excluding WhatsApp outages)

---

> **Legend:**
> - [x] Completed
> - [ ] Planned / In Progress
> - 🟡 Known Issue
> - 🟢 Resolved
> - 🔴 Critical
