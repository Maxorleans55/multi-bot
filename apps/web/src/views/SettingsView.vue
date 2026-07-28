<script setup lang="ts">
import {
  AlertTriangle,
  Bot,
  Brain,
  Coins,
  Command,
  KeyRound,
  type LucideIcon,
  Moon,
  Palette,
  Phone,
  Save,
  Sun,
  Wand2,
  Wrench,
} from '@lucide/vue'
import { useColorMode } from '@vueuse/core'
import { computed, ref } from 'vue'
import SettingsNav from '@/components/settings/SettingsNav.vue'
import SettingRow from '@/components/settings/SettingRow.vue'
import SettingSection from '@/components/settings/SettingSection.vue'
import SettingSwitch from '@/components/settings/SettingSwitch.vue'
import Card from '@/components/ui/card/Card.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import CardDescription from '@/components/ui/card/CardDescription.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Separator from '@/components/ui/separator/Separator.vue'
import { Badge } from '@/components/ui/badge'

interface SettingsSection {
  id: string
  title: string
  icon: LucideIcon
}

const sections: SettingsSection[] = [
  { id: 'profile', title: 'Profil Bot', icon: Bot },
  { id: 'prefixes', title: 'Prefix & Command', icon: Command },
  { id: 'sessions', title: 'Sesi WhatsApp', icon: Phone },
  { id: 'ai', title: 'Perilaku AI', icon: Brain },
  { id: 'tiers', title: 'Limit & Premium', icon: Coins },
  { id: 'maintenance', title: 'Mode Maintenance', icon: Wrench },
  { id: 'appearance', title: 'Tampilan', icon: Palette },
  { id: 'security', title: 'Keamanan Akses', icon: KeyRound },
]

const activeSection = ref<string>('profile')

// ── Profile ─────────────────────────────────────────────────────
const profile = ref({
  botName: 'Bot-Baileys-AI',
  ownerJid: '6281578794887@s.whatsapp.net',
  ownerNumber: '+62 815-7879-4887',
  version: '2.0.0',
  registeredAt: '2026-05-01',
  lastConnected: '25/7/2026, 19.51.07',
})

// ── Prefixes ────────────────────────────────────────────────────
const prefixes = ref<string>('!, ., #, /')
const commandCooldown = ref<number>(2)

// ── AI Behavior ─────────────────────────────────────────────────
const ai = ref({
  provider: 'openrouter',
  model: 'anthropic/claude-3.5-sonnet',
  systemPromptName: 'default',
  maxToolRounds: 4,
  streamResponses: true,
  groupAutoReply: true,
  groupMentionOnly: true,
  toolsEnabled: {
    webSearch: true,
    webFetch: true,
    downloadSocial: true,
    downloadYoutube: true,
    pinterestSearch: true,
    pinterestSticker: true,
  },
})

const toolLabels: Record<string, string> = {
  webSearch: 'Web Search',
  webFetch: 'Web Fetch',
  downloadSocial: 'Social Download',
  downloadYoutube: 'YouTube Download',
  pinterestSearch: 'Pinterest Search',
  pinterestSticker: 'Pinterest Sticker',
}

const toolDescriptions: Record<string, string> = {
  webSearch: 'Cari informasi di web via DuckDuckGo.',
  webFetch: 'Ambil dan baca isi halaman web.',
  downloadSocial: 'Unduh media dari IG / TikTok / FB / X.',
  downloadYoutube: 'Unduh video atau audio YouTube.',
  pinterestSearch: 'Cari gambar di Pinterest.',
  pinterestSticker: 'Buat sticker WhatsApp dari Pinterest.',
}

// ── Tiers ───────────────────────────────────────────────────────
const tiers = ref({
  freeAiChats: 20,
  freeCommandUses: 30,
  premiumAiChats: 200,
  premiumCommandUses: 500,
  proAiChats: 1000,
  proCommandUses: 5000,
})

// ── Maintenance ─────────────────────────────────────────────────
const maintenance = ref({
  enabled: false,
  message: '🔧 Bot sedang dalam maintenance. Silakan coba lagi nanti.',
  bypassOwners: true,
})

// ── Appearance ──────────────────────────────────────────────────
const colorMode = useColorMode()
const isDark = computed({
  get: (): boolean => colorMode.value === 'dark',
  set: (val: boolean): void => {
    colorMode.value = val ? 'dark' : 'light'
  },
})

// ── Security ────────────────────────────────────────────────────
const security = ref({
  dashboardPin: '',
  blockUnknownJid: false,
  logAllMessages: true,
  rateLimitPerMinute: 30,
})

// ── Unsaved-changes indicator ──────────────────────────────────
const unsaved = ref<boolean>(false)
function markDirty(): void {
  unsaved.value = true
}
function resetAll(): void {
  unsaved.value = false
}
function saveAll(): void {
  unsaved.value = false
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="space-y-1">
        <h2 class="text-display text-foreground">Pengaturan Panel</h2>
        <p class="text-body text-muted-foreground">
          Konfigurasi bot, perilaku AI, sesi WhatsApp, dan preferensi tampilan.
        </p>
      </div>
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-150"
        leave-to-class="opacity-0"
      >
        <Badge
          v-if="unsaved"
          variant="destructive"
          class="self-start gap-1 px-2.5 py-1 text-xs rounded-md"
        >
          <AlertTriangle class="size-3" />
          Perubahan belum disimpan
        </Badge>
      </Transition>
    </div>

    <Separator class="bg-border" />

    <!-- Body: nav + content -->
    <div class="flex flex-col gap-6 pb-10 md:flex-row md:items-start">
      <!-- Sticky sub-nav -->
      <SettingsNav
        :sections="sections"
        :active-id="activeSection"
        @select="(id) => (activeSection = id)"
      />

      <!-- Content -->
      <div class="flex-1 min-w-0 space-y-6">
        <!-- ─── Profil Bot ──────────────────────────────────── -->
        <Card v-show="activeSection === 'profile'">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-heading">
              <Bot class="size-4 text-primary" />
              Profil Bot
            </CardTitle>
            <CardDescription>
              Identitas utama bot dan informasi owner.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- Identity card -->
            <div class="flex items-center gap-4 rounded-md border border-border bg-muted/30 p-4">
              <div class="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot class="size-6" />
              </div>
              <div class="min-w-0 flex-1 space-y-1">
                <p class="truncate text-sm font-semibold text-foreground">{{ profile.botName }}</p>
                <p class="truncate font-mono text-xs text-muted-foreground">
                  {{ profile.ownerJid }}
                </p>
                <div class="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary" class="font-normal rounded-md">v{{ profile.version }}</Badge>
                  <Badge class="font-normal rounded-md bg-surface text-surface-foreground hover:bg-surface/90">Aktif</Badge>
                </div>
              </div>
            </div>

            <Separator class="bg-border" />

            <!-- Stacked form fields -->
            <SettingRow label="Nama Bot" description="Nama yang ditampilkan pada pesan bot." html-for="bot-name">
              <Input id="bot-name" v-model="profile.botName" @input="markDirty" />
            </SettingRow>
            <SettingRow label="Nomor Owner" description="Nomor WhatsApp owner (format internasional)." html-for="owner-number">
              <Input id="owner-number" v-model="profile.ownerNumber" class="font-mono" @input="markDirty" />
            </SettingRow>
            <SettingRow label="Owner JID" description="JID lengkap, digunakan untuk whitelist command owner." html-for="owner-jid">
              <Input id="owner-jid" v-model="profile.ownerJid" class="font-mono text-xs" @input="markDirty" />
            </SettingRow>

            <p class="text-xs text-muted-foreground italic">
              Mengubah data akan disimpan ke database saat menekan tombol Simpan.
            </p>

            <!-- Info cards -->
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="rounded-md border border-border bg-muted/30 p-4">
                <p class="text-xs font-medium text-muted-foreground">Terakhir Terhubung</p>
                <p class="mt-1 text-sm font-semibold text-foreground">{{ profile.lastConnected }}</p>
              </div>
              <div class="rounded-md border border-border bg-muted/30 p-4">
                <p class="text-xs font-medium text-muted-foreground">Tanggal Registrasi</p>
                <p class="mt-1 text-sm font-semibold text-foreground">{{ profile.registeredAt }}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- ─── Prefix & Command ────────────────────────────── -->
        <Card v-show="activeSection === 'prefixes'">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-heading">
              <Command class="size-4 text-primary" />
              Prefix & Command
            </CardTitle>
            <CardDescription>
              Atur karakter pemicu perintah dan jeda antar penggunaan.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <SettingRow label="Prefix yang Diizinkan" description="Pisahkan dengan koma. Pesan yang diawali karakter ini akan dianggap perintah." html-for="prefixes">
              <Input id="prefixes" v-model="prefixes" placeholder="!, ., #, /" @input="markDirty" />
            </SettingRow>
            <SettingRow label="Cooldown Default" description="Jeda minimum (detik) antar penggunaan perintah yang sama per pengguna." html-for="cooldown">
              <Input id="cooldown" v-model.number="commandCooldown" type="number" min="0" @input="markDirty" />
            </SettingRow>

            <Separator class="bg-border" />

            <div class="rounded-md border border-border bg-muted/30 p-4">
              <p class="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Contoh Penggunaan
              </p>
              <div class="flex flex-wrap gap-2">
                <Badge variant="outline" class="font-mono rounded-sm">!ping</Badge>
                <Badge variant="outline" class="font-mono rounded-sm">.help</Badge>
                <Badge variant="outline" class="font-mono rounded-sm">#status</Badge>
                <Badge variant="outline" class="font-mono rounded-sm">/ai</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- ─── Sesi WhatsApp ───────────────────────────────── -->
        <Card v-show="activeSection === 'sessions'">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-heading">
              <Phone class="size-4 text-primary" />
              Sesi WhatsApp
            </CardTitle>
            <CardDescription>
              Daftar sesi Baileys yang sedang terhubung ke bot.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="flex items-center justify-between rounded-md border border-border bg-card p-4 transition-design hover:bg-muted/30">
              <div class="flex items-center gap-3">
                <div class="flex size-10 items-center justify-center rounded-full bg-surface/10 text-surface ring-1 ring-surface/20">
                  <Phone class="size-4" />
                </div>
                <div class="space-y-0.5">
                  <p class="text-sm font-medium text-foreground">main</p>
                  <p class="font-mono text-xs text-muted-foreground">+62 815-7879-4887</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="relative flex size-2">
                  <span class="absolute inline-flex size-full animate-ping rounded-full bg-surface opacity-75" />
                  <span class="relative inline-flex size-2 rounded-full bg-surface" />
                </span>
                <Badge class="font-normal rounded-md bg-surface text-surface-foreground hover:bg-surface/90">Aktif</Badge>
              </div>
            </div>

            <p class="px-1 text-xs text-muted-foreground italic">
              Manajemen sesi lengkap (pairing QR, disconnect, reconnect) tersedia di halaman
              <span class="font-mono not-italic">/sessions</span>.
            </p>
          </CardContent>
        </Card>

        <!-- ─── Perilaku AI ─────────────────────────────────── -->
        <Card v-show="activeSection === 'ai'">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-heading">
              <Brain class="size-4 text-primary" />
              Perilaku AI
            </CardTitle>
            <CardDescription>
              Konfigurasi provider, model, dan tool yang boleh dipakai AI.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <SettingSection title="Model" description="Pilih provider dan model LLM yang digunakan.">
              <SettingRow label="Provider" html-for="ai-provider">
                <select
                  id="ai-provider"
                  v-model="ai.provider"
                  class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"
                  @change="markDirty"
                >
                  <option value="openrouter">OpenRouter</option>
                  <option value="openai">OpenAI</option>
                  <option value="ollama">Ollama (lokal)</option>
                  <option value="other">Custom (OpenAI-compatible)</option>
                </select>
              </SettingRow>
              <SettingRow label="Model" html-for="ai-model">
                <Input id="ai-model" v-model="ai.model" class="font-mono text-xs" @input="markDirty" />
              </SettingRow>
              <SettingRow label="System Prompt" html-for="ai-prompt">
                <Input id="ai-prompt" v-model="ai.systemPromptName" @input="markDirty" />
              </SettingRow>
              <SettingRow label="Maks. Putaran Tool" description="Batas maksimum iterasi function calling per pesan (1–10)." html-for="ai-rounds">
                <Input id="ai-rounds" v-model.number="ai.maxToolRounds" type="number" min="0" max="10" @input="markDirty" />
              </SettingRow>
            </SettingSection>

            <Separator class="bg-border" />

            <SettingSection title="Fitur" description="Aktif/nonaktifkan perilaku AI di chat pribadi dan grup.">
              <SettingSwitch
                v-model="ai.streamResponses"
                label="Streaming respons"
                description="Kirim jawaban AI sedikit demi sedikit menggunakan typing indicator."
                @update:model-value="markDirty"
              />
              <SettingSwitch
                v-model="ai.groupAutoReply"
                label="Auto-reply di grup"
                description="Bot membalas pesan di grup ketika disebut atau di-reply."
                @update:model-value="markDirty"
              />
              <SettingSwitch
                v-model="ai.groupMentionOnly"
                label="Hanya saat di-tag / di-reply"
                description="Jika dimatikan, bot akan membalas semua pesan grup."
                @update:model-value="markDirty"
              />
            </SettingSection>

            <Separator class="bg-border" />

            <SettingSection title="Tools (Function Calling)" description="Aktifkan/nonaktifkan tool yang dapat dipakai AI.">
              <div class="grid gap-4 sm:grid-cols-2">
                <SettingSwitch
                  v-for="(_, key) in ai.toolsEnabled"
                  :key="key"
                  v-model="ai.toolsEnabled[key]"
                  :label="toolLabels[key] ?? key"
                  :description="toolDescriptions[key] ?? 'Aktifkan tool untuk AI.'"
                  @update:model-value="markDirty"
                />
              </div>
            </SettingSection>
          </CardContent>
        </Card>

        <!-- ─── Limit & Premium ─────────────────────────────── -->
        <Card v-show="activeSection === 'tiers'">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-heading">
              <Coins class="size-4 text-primary" />
              Limit & Premium
            </CardTitle>
            <CardDescription>
              Batas harian chat AI dan penggunaan perintah per tier pengguna.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <SettingSection title="Free">
              <SettingRow label="Chat AI / hari" html-for="tier-free-ai">
                <Input id="tier-free-ai" v-model.number="tiers.freeAiChats" type="number" min="0" @input="markDirty" />
              </SettingRow>
              <SettingRow label="Perintah / hari" html-for="tier-free-cmd">
                <Input id="tier-free-cmd" v-model.number="tiers.freeCommandUses" type="number" min="0" @input="markDirty" />
              </SettingRow>
            </SettingSection>

            <Separator class="bg-border" />

            <SettingSection title="Premium">
              <SettingRow label="Chat AI / hari" html-for="tier-premium-ai">
                <Input id="tier-premium-ai" v-model.number="tiers.premiumAiChats" type="number" min="0" @input="markDirty" />
              </SettingRow>
              <SettingRow label="Perintah / hari" html-for="tier-premium-cmd">
                <Input id="tier-premium-cmd" v-model.number="tiers.premiumCommandUses" type="number" min="0" @input="markDirty" />
              </SettingRow>
            </SettingSection>

            <Separator class="bg-border" />

            <SettingSection title="Pro">
              <SettingRow label="Chat AI / hari" html-for="tier-pro-ai">
                <Input id="tier-pro-ai" v-model.number="tiers.proAiChats" type="number" min="0" @input="markDirty" />
              </SettingRow>
              <SettingRow label="Perintah / hari" html-for="tier-pro-cmd">
                <Input id="tier-pro-cmd" v-model.number="tiers.proCommandUses" type="number" min="0" @input="markDirty" />
              </SettingRow>
            </SettingSection>
          </CardContent>
        </Card>

        <!-- ─── Maintenance ─────────────────────────────────── -->
        <Card v-show="activeSection === 'maintenance'">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-heading">
              <Wrench class="size-4 text-primary" />
              Mode Maintenance
            </CardTitle>
            <CardDescription>
              Nonaktifkan sementara bot untuk semua pengguna.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <SettingSection>
              <SettingSwitch
                v-model="maintenance.enabled"
                label="Aktifkan maintenance"
                description="Bot menolak semua pesan kecuali owner (jika bypass diaktifkan)."
                @update:model-value="markDirty"
              />
              <SettingSwitch
                v-model="maintenance.bypassOwners"
                label="Bypass untuk owner"
                description="Owner tetap bisa menggunakan bot walaupun maintenance aktif."
                @update:model-value="markDirty"
              />
            </SettingSection>

            <Separator class="bg-border" />

            <SettingRow label="Pesan Maintenance" description="Pesan yang dikirim ke pengguna ketika bot dalam mode maintenance." html-for="maint-msg">
              <Input id="maint-msg" v-model="maintenance.message" @input="markDirty" />
            </SettingRow>

            <div class="rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
              <div class="flex gap-3">
                <AlertTriangle class="size-5 shrink-0 text-amber-500" />
                <div class="space-y-1">
                  <p class="text-sm font-medium text-foreground">Pratinjau Pesan</p>
                  <p class="text-xs text-muted-foreground italic">
                    "{{ maintenance.message }}"
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- ─── Tampilan ────────────────────────────────────── -->
        <Card v-show="activeSection === 'appearance'">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-heading">
              <Palette class="size-4 text-primary" />
              Tampilan
            </CardTitle>
            <CardDescription>
              Preferensi visual dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <SettingSection>
              <SettingSwitch
                :model-value="isDark"
                :label="isDark ? 'Mode Gelap Aktif' : 'Mode Terang Aktif'"
                :description="isDark
                  ? 'Tampilan menggunakan palet warna gelap.'
                  : 'Tampilan menggunakan palet warna terang.'"
                @update:model-value="(v) => (isDark = v)"
              />
            </SettingSection>

            <Separator class="bg-border" />

            <div>
              <p class="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pratinjau
              </p>
              <div class="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  class="group flex flex-col items-start gap-2 rounded-md border border-border bg-background p-4 text-left transition-design hover:border-primary hover:shadow-sm"
                  :class="{ 'ring-2 ring-primary': !isDark }"
                  @click="isDark = false"
                >
                  <div class="flex w-full items-center justify-between">
                    <Sun class="size-4 text-amber-500" />
                    <Badge v-if="!isDark" variant="default" class="text-[10px] rounded-sm">Aktif</Badge>
                  </div>
                  <div class="space-y-1.5 w-full">
                    <div class="h-2 w-3/4 rounded bg-foreground" />
                    <div class="h-2 w-1/2 rounded bg-muted-foreground/50" />
                  </div>
                  <p class="text-xs font-medium text-foreground">Light</p>
                </button>

                <button
                  type="button"
                  class="group flex flex-col items-start gap-2 rounded-md border border-border bg-foreground p-4 text-left transition-design hover:border-primary hover:shadow-sm"
                  :class="{ 'ring-2 ring-primary': isDark }"
                  @click="isDark = true"
                >
                  <div class="flex w-full items-center justify-between">
                    <Moon class="size-4 text-blue-400" />
                    <Badge v-if="isDark" variant="default" class="text-[10px] rounded-sm">Aktif</Badge>
                  </div>
                  <div class="space-y-1.5 w-full">
                    <div class="h-2 w-3/4 rounded bg-background" />
                    <div class="h-2 w-1/2 rounded bg-muted-foreground" />
                  </div>
                  <p class="text-xs font-medium text-background">Dark</p>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- ─── Keamanan Akses ──────────────────────────────── -->
        <Card v-show="activeSection === 'security'">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-heading">
              <KeyRound class="size-4 text-primary" />
              Keamanan Akses
            </CardTitle>
            <CardDescription>
              PIN dashboard, filter JID, dan logging pesan.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <SettingRow label="PIN Dashboard" description="PIN akan diminta setiap kali dashboard dibuka di peramban baru." html-for="pin">
              <Input id="pin" v-model="security.dashboardPin" type="password" placeholder="••••••" class="font-mono tracking-widest" @input="markDirty" />
            </SettingRow>
            <SettingRow label="Rate Limit" description="Batas pesan per pengguna per menit." html-for="rate-limit">
              <Input id="rate-limit" v-model.number="security.rateLimitPerMinute" type="number" min="1" @input="markDirty" />
            </SettingRow>

            <Separator class="bg-border" />

            <SettingSection title="Filter & Logging">
              <SettingSwitch
                v-model="security.blockUnknownJid"
                label="Blokir JID tidak dikenal"
                description="Tolak pesan dari JID yang belum pernah terdaftar di database."
                @update:model-value="markDirty"
              />
              <SettingSwitch
                v-model="security.logAllMessages"
                label="Log semua pesan"
                description="Simpan salinan semua pesan masuk/keluar untuk audit."
                @update:model-value="markDirty"
              />
            </SettingSection>
          </CardContent>
        </Card>

        <!-- Footer actions -->
        <div
          v-if="activeSection !== 'appearance'"
          class="flex items-center justify-end gap-2 pt-2"
        >
          <Button variant="ghost" :disabled="!unsaved" @click="resetAll">
            Reset
          </Button>
          <Button :disabled="!unsaved" @click="saveAll">
            <Save class="size-4" />
            Simpan Perubahan
          </Button>
        </div>
        <div v-else class="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" @click="markDirty">
            <Wand2 class="size-4" />
            Terapkan Perubahan
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
