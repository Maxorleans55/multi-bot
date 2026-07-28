<script setup lang="ts">
import { ref, computed } from 'vue'
import { MessageSquareText, Search, Send, ChevronLeft } from '@lucide/vue'
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Input from '@/components/ui/input/Input.vue'
import Button from '@/components/ui/button/Button.vue'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import AvatarFallback from '@/components/ui/avatar/AvatarFallback.vue'
import ScrollArea from '@/components/ui/scroll-area/ScrollArea.vue'

// ── Types ──────────────────────────────────────────────────────────
interface ChatMessage {
  id: string
  fromMe: boolean
  from: string
  pushName: string
  body: string
  timestamp: Date
}

interface Conversation {
  id: string
  sessionId: string
  userJid: string
  pushName: string
  lastMessage: string
  lastMessageAt: Date
  unread: number
  aiMode: boolean
  messages: ChatMessage[]
}

// ── Mock Data ──────────────────────────────────────────────────────
const conversations = ref<Conversation[]>([
  {
    id: 'conv-1',
    sessionId: 'Wahyu',
    userJid: '6281234567890@s.whatsapp.net',
    pushName: 'Budi Santoso',
    lastMessage: 'Tolong bikin stiker dari gambar ini',
    lastMessageAt: new Date(Date.now() - 2 * 60 * 1000),
    unread: 0,
    aiMode: true,
    messages: [
      { id: 'm1', fromMe: false, from: '6281234567890@s.whatsapp.net', pushName: 'Budi Santoso', body: 'Halo bot, bisa bantu?', timestamp: new Date(Date.now() - 10 * 60 * 1000) },
      { id: 'm2', fromMe: true, from: 'bot', pushName: 'Bot', body: 'Halo Budi! Ada yang bisa saya bantu? 😊', timestamp: new Date(Date.now() - 9 * 60 * 1000) },
      { id: 'm3', fromMe: false, from: '6281234567890@s.whatsapp.net', pushName: 'Budi Santoso', body: 'Tolong bikin stiker dari gambar ini', timestamp: new Date(Date.now() - 2 * 60 * 1000) },
    ],
  },
  {
    id: 'conv-2',
    sessionId: 'Wahyu',
    userJid: '6289876543210@s.whatsapp.net',
    pushName: 'Siti Rahayu',
    lastMessage: 'Cariin resep nasi goreng dong',
    lastMessageAt: new Date(Date.now() - 15 * 60 * 1000),
    unread: 2,
    aiMode: true,
    messages: [
      { id: 'm4', fromMe: false, from: '6289876543210@s.whatsapp.net', pushName: 'Siti Rahayu', body: 'Bot, kamu bisa masak gak?', timestamp: new Date(Date.now() - 30 * 60 * 1000) },
      { id: 'm5', fromMe: true, from: 'bot', pushName: 'Bot', body: 'Halo Siti! Saya bisa bantu cari resep kok. Mau resep apa?', timestamp: new Date(Date.now() - 29 * 60 * 1000) },
      { id: 'm6', fromMe: false, from: '6289876543210@s.whatsapp.net', pushName: 'Siti Rahayu', body: 'Cariin resep nasi goreng dong', timestamp: new Date(Date.now() - 15 * 60 * 1000) },
      { id: 'm7', fromMe: false, from: '6289876543210@s.whatsapp.net', pushName: 'Siti Rahayu', body: 'Yang simpel aja ya', timestamp: new Date(Date.now() - 14 * 60 * 1000) },
    ],
  },
  {
    id: 'conv-3',
    sessionId: 'Bot Support',
    userJid: '6283334445556@s.whatsapp.net',
    pushName: 'Andi Pratama',
    lastMessage: 'Download video TikTok ini https://vt.tiktok.com/...',
    lastMessageAt: new Date(Date.now() - 45 * 60 * 1000),
    unread: 0,
    aiMode: false,
    messages: [
      { id: 'm8', fromMe: false, from: '6283334445556@s.whatsapp.net', pushName: 'Andi Pratama', body: 'Hai, bisa download TikTok gak?', timestamp: new Date(Date.now() - 50 * 60 * 1000) },
      { id: 'm9', fromMe: true, from: 'bot', pushName: 'Bot', body: 'Bisa banget! Kirim link-nya ya 🎵', timestamp: new Date(Date.now() - 49 * 60 * 1000) },
      { id: 'm10', fromMe: false, from: '6283334445556@s.whatsapp.net', pushName: 'Andi Pratama', body: 'Download video TikTok ini https://vt.tiktok.com/...', timestamp: new Date(Date.now() - 45 * 60 * 1000) },
    ],
  },
  {
    id: 'conv-4',
    sessionId: 'Bot Support',
    userJid: '6285556667778@s.whatsapp.net',
    pushName: 'Dewi Lestari',
    lastMessage: 'Pukul berapa sekarang di Jakarta? 😂',
    lastMessageAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    unread: 0,
    aiMode: true,
    messages: [
      { id: 'm11', fromMe: false, from: '6285556667778@s.whatsapp.net', pushName: 'Dewi Lestari', body: 'Bot, lagi ngapain?', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000) },
      { id: 'm12', fromMe: true, from: 'bot', pushName: 'Bot', body: 'Lagi santai nih Dewi. Ada yang bisa dibantu?', timestamp: new Date(Date.now() - 3.9 * 60 * 60 * 1000) },
      { id: 'm13', fromMe: false, from: '6285556667778@s.whatsapp.net', pushName: 'Dewi Lestari', body: 'Pukul berapa sekarang di Jakarta? 😂', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000) },
      { id: 'm14', fromMe: true, from: 'bot', pushName: 'Bot', body: 'Sekarang pukul 15:00 WIB, Dewi. Ngapain nanya jam? HAHAHA', timestamp: new Date(Date.now() - 2.9 * 60 * 60 * 1000) },
    ],
  },
  {
    id: 'conv-5',
    sessionId: 'Wahyu',
    userJid: '6284443332221@s.whatsapp.net',
    pushName: 'Rizky Fauzan',
    lastMessage: 'Cari gambar pemandangan di Pinterest',
    lastMessageAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    unread: 1,
    aiMode: true,
    messages: [
      { id: 'm15', fromMe: false, from: '6284443332221@s.whatsapp.net', pushName: 'Rizky Fauzan', body: 'Bot cariin gambar pemandangan dong', timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000) },
      { id: 'm16', fromMe: true, from: 'bot', pushName: 'Bot', body: 'Oke Rizky, saya cari di Pinterest ya. Sebentar...', timestamp: new Date(Date.now() - 5.9 * 60 * 60 * 1000) },
      { id: 'm17', fromMe: true, from: 'bot', pushName: 'Bot', body: 'Nih beberapa hasilnya: [3 gambar pemandangan]', timestamp: new Date(Date.now() - 5.8 * 60 * 60 * 1000) },
      { id: 'm18', fromMe: false, from: '6284443332221@s.whatsapp.net', pushName: 'Rizky Fauzan', body: 'Cari gambar pemandangan di Pinterest', timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000) },
    ],
  },
])

// ── State ──────────────────────────────────────────────────────────
const selectedConvId = ref<string | null>(null)
const searchQuery = ref('')
const replyText = ref('')
const isSending = ref(false)

const selectedConv = computed(() =>
  conversations.value.find((c) => c.id === selectedConvId.value) ?? null,
)

const filteredConversations = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return conversations.value
  return conversations.value.filter(
    (c) =>
      c.pushName.toLowerCase().includes(q) ||
      c.userJid.toLowerCase().includes(q) ||
      c.lastMessage.toLowerCase().includes(q),
  )
})

const totalUnread = computed(() =>
  conversations.value.reduce((sum, c) => sum + c.unread, 0),
)

// ── Helpers ────────────────────────────────────────────────────────
function selectConversation(id: string) {
  selectedConvId.value = id
  // mark as read
  const conv = conversations.value.find((c) => c.id === id)
  if (conv) conv.unread = 0
}

function formatTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Baru saja'
  if (diffMin < 60) return `${diffMin}m`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}j`
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function sendReply() {
  const text = replyText.value.trim()
  if (!text || !selectedConv.value) return

  isSending.value = true

  // simulate sending
  setTimeout(() => {
    const newMsg: ChatMessage = {
      id: `m${Date.now()}`,
      fromMe: true,
      from: 'bot',
      pushName: 'Bot',
      body: text,
      timestamp: new Date(),
    }
    selectedConv.value!.messages.push(newMsg)
    selectedConv.value!.lastMessage = text
    selectedConv.value!.lastMessageAt = new Date()
    replyText.value = ''
    isSending.value = false
  }, 400)
}

function onReplyKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendReply()
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Page Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-display text-foreground">Chat Logs</h2>
        <p class="text-body text-muted-foreground mt-1">
          Conversations between users and the bot — view messages and reply from the dashboard.
        </p>
      </div>
      <Badge v-if="totalUnread > 0" variant="default" class="text-xs rounded-md">
        {{ totalUnread }} unread
      </Badge>
    </div>

    <!-- Chat Layout: Conversation List + Thread -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-0 rounded-md border border-border bg-card overflow-hidden" style="min-height: 620px; max-height: calc(100vh - 200px);">
      <!-- LEFT: Conversation List -->
      <div
        class="lg:col-span-4 xl:col-span-3 border-r border-border flex flex-col"
        :class="{ 'hidden lg:flex': selectedConvId, 'flex': !selectedConvId }"
      >
        <!-- Search -->
        <div class="p-3 border-b border-border">
          <div class="relative">
            <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              placeholder="Cari percakapan..."
              class="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        <!-- Conversation Items -->
        <ScrollArea class="flex-1">
          <div v-if="filteredConversations.length === 0" class="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MessageSquareText class="size-10 mb-3 opacity-40" />
            <p class="text-sm">Tidak ada percakapan</p>
          </div>

          <div
            v-for="conv in filteredConversations"
            :key="conv.id"
            class="flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-border/50 hover:bg-muted/50 transition-design"
            :class="{ 'bg-muted/70': selectedConvId === conv.id }"
            @click="selectConversation(conv.id)"
          >
            <Avatar class="size-10 shrink-0 rounded-full">
              <AvatarFallback class="rounded-full text-xs bg-primary/10 text-primary font-semibold">
                {{ initials(conv.pushName) }}
              </AvatarFallback>
            </Avatar>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-foreground truncate">{{ conv.pushName }}</span>
                <span class="text-[11px] text-muted-foreground shrink-0">{{ formatTime(conv.lastMessageAt) }}</span>
              </div>
              <div class="flex items-center justify-between gap-2 mt-0.5">
                <span class="text-xs text-muted-foreground truncate">{{ conv.lastMessage }}</span>
                <Badge v-if="conv.unread > 0" variant="default" class="text-[10px] px-1.5 py-0 shrink-0 rounded-sm">
                  {{ conv.unread }}
                </Badge>
              </div>
              <div class="flex items-center gap-1.5 mt-1">
                <Badge :variant="conv.aiMode ? 'default' : 'secondary'" class="text-[10px] px-1.5 py-0 rounded-sm">
                  {{ conv.aiMode ? 'AI' : 'CMD' }}
                </Badge>
                <span class="text-[10px] text-muted-foreground">{{ conv.sessionId }}</span>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      <!-- RIGHT: Chat Thread -->
      <div
        class="lg:col-span-8 xl:col-span-9 flex flex-col"
        :class="{ 'hidden lg:flex': !selectedConvId, 'flex': selectedConvId }"
      >
        <!-- Empty State -->
        <template v-if="!selectedConv">
          <div class="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <div class="flex size-16 items-center justify-center rounded-full bg-muted">
              <MessageSquareText class="size-8 opacity-40" />
            </div>
            <p class="text-sm font-medium">Pilih percakapan</p>
            <p class="text-xs">Klik salah satu chat di panel kiri untuk melihat pesan.</p>
          </div>
        </template>

        <!-- Thread with messages -->
        <template v-else>
          <!-- Thread Header -->
          <div class="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
            <button
              class="lg:hidden flex items-center justify-center size-8 rounded-md hover:bg-muted transition-design -ml-1"
              @click="selectedConvId = null"
            >
              <ChevronLeft class="size-5" />
            </button>
            <Avatar class="size-9 shrink-0 rounded-full">
              <AvatarFallback class="rounded-full text-xs bg-primary/10 text-primary font-semibold">
                {{ initials(selectedConv.pushName) }}
              </AvatarFallback>
            </Avatar>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-foreground truncate">{{ selectedConv.pushName }}</p>
              <p class="text-xs text-muted-foreground">{{ selectedConv.userJid }}</p>
            </div>
            <Badge :variant="selectedConv.aiMode ? 'default' : 'secondary'" class="text-[10px] px-1.5 py-0 shrink-0 rounded-sm">
              {{ selectedConv.aiMode ? 'AI Mode' : 'CMD' }}
            </Badge>
          </div>

          <!-- Messages -->
          <ScrollArea class="flex-1">
            <div class="flex flex-col gap-1 p-4">
              <div
                v-for="msg in selectedConv.messages"
                :key="msg.id"
                class="flex gap-3 max-w-[80%]"
                :class="msg.fromMe ? 'self-end flex-row-reverse' : 'self-start'"
              >
                <Avatar class="size-7 shrink-0 rounded-full mt-1">
                  <AvatarFallback class="rounded-full text-[10px]" :class="msg.fromMe ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'">
                    {{ msg.fromMe ? 'BT' : initials(msg.pushName) }}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div
                    class="rounded-2xl px-3.5 py-2 text-sm leading-relaxed"
                    :class="msg.fromMe
                      ? 'bg-primary text-primary-foreground rounded-tr-md'
                      : 'bg-muted rounded-tl-md'"
                  >
                    {{ msg.body }}
                  </div>
                  <div class="flex items-center gap-2 mt-1" :class="msg.fromMe ? 'justify-end' : 'justify-start'">
                    <span class="text-[10px] text-muted-foreground">{{ formatMessageTime(msg.timestamp) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <!-- Reply Input -->
          <div class="border-t border-border p-3 shrink-0">
            <div class="flex items-end gap-2">
              <textarea
                v-model="replyText"
                placeholder="Ketik balasan..."
                rows="1"
                class="flex-1 min-h-10 max-h-32 resize-none rounded-md border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                @keydown="onReplyKeydown"
                @input="(e: Event) => {
                  const t = e.target as HTMLTextAreaElement
                  t.style.height = 'auto'
                  t.style.height = Math.min(t.scrollHeight, 128) + 'px'
                }"
              />
              <Button
                size="icon"
                class="size-10 shrink-0 rounded-md"
                :disabled="!replyText.trim() || isSending"
                @click="sendReply"
              >
                <Send class="size-4" :class="{ 'animate-pulse': isSending }" />
              </Button>
            </div>
            <p class="text-[10px] text-muted-foreground mt-1.5 ml-1">
              <template v-if="selectedConv.aiMode">
                Balasan dikirim sebagai bot melalui AI mode - user akan menerima pesan dari nomor WA.
              </template>
              <template v-else>
                User ini tidak dalam AI mode. Balasan hanya simulasi.
              </template>
            </p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
