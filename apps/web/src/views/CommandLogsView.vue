<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Command, Terminal, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, XCircle } from '@lucide/vue'
import Card from '@/components/ui/card/Card.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Input from '@/components/ui/input/Input.vue'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import AvatarFallback from '@/components/ui/avatar/AvatarFallback.vue'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────
interface CommandLog {
  id: string
  command: string
  args: string
  pushName: string
  jid: string
  session: string
  timestamp: Date
  status: 'success' | 'error'
  responseTime: number // in ms
  category: string
  groupName?: string
  errorMessage?: string
}

// ── Mock Data ──────────────────────────────────────────────────────
const logs = ref<CommandLog[]>([
  {
    id: 'cl-01',
    command: '!ping',
    args: '',
    pushName: 'Budi Santoso',
    jid: '6281234567890@s.whatsapp.net',
    session: 'Wahyu',
    timestamp: new Date(Date.now() - 1 * 60 * 1000),
    status: 'success',
    responseTime: 127,
    category: 'basic',
  },
  {
    id: 'cl-02',
    command: '!sticker',
    args: '(image attached)',
    pushName: 'Siti Rahayu',
    jid: '6289876543210@s.whatsapp.net',
    session: 'Wahyu',
    timestamp: new Date(Date.now() - 3 * 60 * 1000),
    status: 'success',
    responseTime: 843,
    category: 'media',
  },
  {
    id: 'cl-03',
    command: '!tiktok',
    args: 'https://vt.tiktok.com/ZS1234567/',
    pushName: 'Andi Pratama',
    jid: '6283334445556@s.whatsapp.net',
    session: 'Bot Support',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    status: 'success',
    responseTime: 2341,
    category: 'media',
  },
  {
    id: 'cl-04',
    command: '!ai',
    args: 'on',
    pushName: 'Dewi Lestari',
    jid: '6285556667778@s.whatsapp.net',
    session: 'Bot Support',
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
    status: 'success',
    responseTime: 93,
    category: 'ai',
  },
  {
    id: 'cl-05',
    command: '!help',
    args: '',
    pushName: 'Rizky Fauzan',
    jid: '6284443332221@s.whatsapp.net',
    session: 'Wahyu',
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    status: 'success',
    responseTime: 156,
    category: 'basic',
  },
  {
    id: 'cl-06',
    command: '!instagram',
    args: 'https://instagram.com/p/ABC123/',
    pushName: 'Maya Indah',
    jid: '6281112223334@s.whatsapp.net',
    session: 'Premium Bot',
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
    status: 'error',
    responseTime: 5432,
    category: 'media',
    errorMessage: 'Invalid URL or media not found',
  },
  {
    id: 'cl-07',
    command: '!hidetag',
    args: 'Selamat pagi semua!',
    pushName: 'Hendra Gunawan',
    jid: '6287778889990@s.whatsapp.net',
    session: 'Premium Bot',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    status: 'success',
    responseTime: 210,
    category: 'group',
    groupName: 'Keluarga Bahagia',
  },
  {
    id: 'cl-08',
    command: '!youtube',
    args: 'https://youtube.com/watch?v=dQw4w9WgXcQ audio',
    pushName: 'Ratna Sari',
    jid: '6289990001112@s.whatsapp.net',
    session: 'Wahyu',
    timestamp: new Date(Date.now() - 18 * 60 * 1000),
    status: 'success',
    responseTime: 5678,
    category: 'media',
  },
  {
    id: 'cl-09',
    command: '!status',
    args: '',
    pushName: 'Dimas Ardiansyah',
    jid: '6286665554443@s.whatsapp.net',
    session: 'Bot Support',
    timestamp: new Date(Date.now() - 20 * 60 * 1000),
    status: 'success',
    responseTime: 89,
    category: 'basic',
  },
  {
    id: 'cl-10',
    command: '!premium',
    args: 'add 6281234567890 30',
    pushName: 'Wahyu',
    jid: '6281234567890@s.whatsapp.net',
    session: 'Wahyu',
    timestamp: new Date(Date.now() - 25 * 60 * 1000),
    status: 'success',
    responseTime: 178,
    category: 'owner',
  },
  {
    id: 'cl-11',
    command: '!pinterest',
    args: 'pemandangan alam',
    pushName: 'Fitri Handayani',
    jid: '6283337778889@s.whatsapp.net',
    session: 'Premium Bot',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    status: 'success',
    responseTime: 3120,
    category: 'media',
  },
  {
    id: 'cl-12',
    command: '!sticker',
    args: '(video attached)',
    pushName: 'Agus Wijaya',
    jid: '6282225556667@s.whatsapp.net',
    session: 'Wahyu',
    timestamp: new Date(Date.now() - 35 * 60 * 1000),
    status: 'error',
    responseTime: 4500,
    category: 'media',
    errorMessage: 'Video too large (>5MB)',
  },
  {
    id: 'cl-13',
    command: '!changelog',
    args: '',
    pushName: 'Putri Ayuningtyas',
    jid: '6288881112223@s.whatsapp.net',
    session: 'Bot Support',
    timestamp: new Date(Date.now() - 40 * 60 * 1000),
    status: 'success',
    responseTime: 112,
    category: 'basic',
  },
  {
    id: 'cl-14',
    command: '!setgroup',
    args: 'close',
    pushName: 'Budi Santoso',
    jid: '6281234567890@s.whatsapp.net',
    session: 'Wahyu',
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    status: 'success',
    responseTime: 345,
    category: 'group',
    groupName: 'Tech Discussion',
  },
  {
    id: 'cl-15',
    command: '!togglebot',
    args: 'on',
    pushName: 'Siti Rahayu',
    jid: '6289876543210@s.whatsapp.net',
    session: 'Wahyu',
    timestamp: new Date(Date.now() - 50 * 60 * 1000),
    status: 'success',
    responseTime: 167,
    category: 'group',
    groupName: 'Keluarga Bahagia',
  },
  {
    id: 'cl-16',
    command: '!speedtest',
    args: '',
    pushName: 'Wahyu',
    jid: '6281234567890@s.whatsapp.net',
    session: 'Wahyu',
    timestamp: new Date(Date.now() - 55 * 60 * 1000),
    status: 'success',
    responseTime: 8923,
    category: 'owner',
  },
  {
    id: 'cl-17',
    command: '!reportbug',
    args: 'Sticker command not working for large videos',
    pushName: 'Rizky Fauzan',
    jid: '6284443332221@s.whatsapp.net',
    session: 'Wahyu',
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    status: 'success',
    responseTime: 210,
    category: 'basic',
  },
  {
    id: 'cl-18',
    command: '!facebook',
    args: 'https://facebook.com/watch?v=123456',
    pushName: 'Hendra Gunawan',
    jid: '6287778889990@s.whatsapp.net',
    session: 'Premium Bot',
    timestamp: new Date(Date.now() - 65 * 60 * 1000),
    status: 'error',
    responseTime: 6789,
    category: 'media',
    errorMessage: 'Video download failed - private content',
  },
  {
    id: 'cl-19',
    command: '!list',
    args: '',
    pushName: 'Dimas Ardiansyah',
    jid: '6286665554443@s.whatsapp.net',
    session: 'Bot Support',
    timestamp: new Date(Date.now() - 70 * 60 * 1000),
    status: 'success',
    responseTime: 145,
    category: 'session',
  },
  {
    id: 'cl-20',
    command: '!twitter',
    args: 'https://twitter.com/username/status/123456789',
    pushName: 'Putri Ayuningtyas',
    jid: '6288881112223@s.whatsapp.net',
    session: 'Bot Support',
    timestamp: new Date(Date.now() - 75 * 60 * 1000),
    status: 'success',
    responseTime: 2890,
    category: 'media',
  },
  {
    id: 'cl-21',
    command: '!sticker',
    args: '(image attached)',
    pushName: 'Dewi Lestari',
    jid: '6285556667778@s.whatsapp.net',
    session: 'Bot Support',
    timestamp: new Date(Date.now() - 80 * 60 * 1000),
    status: 'success',
    responseTime: 920,
    category: 'media',
  },
  {
    id: 'cl-22',
    command: '!pinterest',
    args: 'musik relaksasi',
    pushName: 'Fitri Handayani',
    jid: '6283337778889@s.whatsapp.net',
    session: 'Premium Bot',
    timestamp: new Date(Date.now() - 90 * 60 * 1000),
    status: 'success',
    responseTime: 2890,
    category: 'media',
  },
  {
    id: 'cl-23',
    command: '!help',
    args: 'sticker',
    pushName: 'Maya Indah',
    jid: '6281112223334@s.whatsapp.net',
    session: 'Premium Bot',
    timestamp: new Date(Date.now() - 100 * 60 * 1000),
    status: 'success',
    responseTime: 134,
    category: 'basic',
  },
  {
    id: 'cl-24',
    command: '!ping',
    args: '',
    pushName: 'Ratna Sari',
    jid: '6289990001112@s.whatsapp.net',
    session: 'Wahyu',
    timestamp: new Date(Date.now() - 120 * 60 * 1000),
    status: 'success',
    responseTime: 118,
    category: 'basic',
  },
  {
    id: 'cl-25',
    command: '!eval',
    args: 'console.log("test")',
    pushName: 'Wahyu',
    jid: '6281234567890@s.whatsapp.net',
    session: 'Wahyu',
    timestamp: new Date(Date.now() - 150 * 60 * 1000),
    status: 'success',
    responseTime: 256,
    category: 'owner',
  },
  {
    id: 'cl-26',
    command: '!tiktok',
    args: 'https://vm.tiktok.com/ZS9876543/',
    pushName: 'Andi Pratama',
    jid: '6283334445556@s.whatsapp.net',
    session: 'Bot Support',
    timestamp: new Date(Date.now() - 180 * 60 * 1000),
    status: 'error',
    responseTime: 4321,
    category: 'media',
    errorMessage: 'Video unavailable or restricted',
  },
])

// ── Stats ──────────────────────────────────────────────────────────
const totalCommands = computed(() => logs.value.length)
const successCount = computed(() => logs.value.filter((l) => l.status === 'success').length)
const errorCount = computed(() => logs.value.filter((l) => l.status === 'error').length)
const avgResponseTime = computed(() => {
  const total = logs.value.reduce((sum, l) => sum + l.responseTime, 0)
  return Math.round(total / logs.value.length)
})

const statCards = computed(() => [
  { label: 'Total Commands', value: totalCommands.value, icon: Command, change: `${successCount.value} succeeded`, changeType: 'up' as const },
  { label: 'Success Rate', value: `${Math.round(successCount.value / totalCommands.value * 100)}%`, icon: CheckCircle2, change: `${errorCount.value} failed`, changeType: successCount.value > errorCount.value ? 'up' as const : 'down' as const },
  { label: 'Avg Response', value: `${avgResponseTime.value}ms`, icon: Clock, change: '± 0ms vs yesterday', changeType: 'neutral' as const },
  { label: 'Errors', value: errorCount.value, icon: XCircle, change: `${errorCount.value} total errors`, changeType: 'down' as const },
])

// ── Search & Filter ────────────────────────────────────────────────
const searchQuery = ref('')
const categoryFilter = ref<string>('all')
const statusFilter = ref<'all' | 'success' | 'error'>('all')

const categories = computed(() => {
  const cats = new Set(logs.value.map((l) => l.category))
  return ['all', ...Array.from(cats)]
})

const filteredLogs = computed(() => {
  let result = logs.value

  const q = searchQuery.value.toLowerCase().trim()
  if (q) {
    result = result.filter(
      (l) =>
        l.command.toLowerCase().includes(q) ||
        l.pushName.toLowerCase().includes(q) ||
        l.jid.toLowerCase().includes(q) ||
        l.args.toLowerCase().includes(q) ||
        l.session.toLowerCase().includes(q),
    )
  }

  if (categoryFilter.value !== 'all') {
    result = result.filter((l) => l.category === categoryFilter.value)
  }

  if (statusFilter.value !== 'all') {
    result = result.filter((l) => l.status === statusFilter.value)
  }

  return result
})

// ── Helpers ────────────────────────────────────────────────────────
function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function timeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  return `${diffDay}d ago`
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function formatResponseTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const categoryLabel: Record<string, string> = {
  basic: 'Basic',
  media: 'Media',
  group: 'Group',
  owner: 'Owner',
  ai: 'AI',
  session: 'Session',
}

const categoryBadgeVariant = (cat: string): 'default' | 'secondary' | 'outline' => {
  const map: Record<string, 'default' | 'secondary' | 'outline'> = {
    basic: 'secondary',
    media: 'default',
    group: 'outline',
    owner: 'secondary',
    ai: 'default',
    session: 'outline',
  }
  return map[cat] ?? 'secondary'
}

const responseTimeColor = (ms: number): string => {
  if (ms < 200) return 'text-surface'
  if (ms < 2000) return 'text-foreground'
  if (ms < 5000) return 'text-amber-500'
  return 'text-destructive'
}
</script>

<template>
  <div class="space-y-7">
    <!-- Page Header -->
    <div>
      <h2 class="text-display text-foreground">Command Logs</h2>
      <p class="text-body text-muted-foreground mt-1">
        Track every command executed across all bot sessions in real-time.
      </p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card v-for="stat in statCards" :key="stat.label">
        <CardContent class="p-5">
          <div class="flex items-start justify-between">
            <div class="space-y-1.5">
              <p class="text-body text-muted-foreground">{{ stat.label }}</p>
              <p class="text-2xl font-semibold tracking-tight text-foreground">{{ stat.value }}</p>
            </div>
            <div class="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <component :is="stat.icon" class="size-5 text-primary" />
            </div>
          </div>
          <div class="mt-4 flex items-center gap-1.5">
            <component
              :is="stat.changeType === 'up' ? ArrowUpRight : stat.changeType === 'down' ? ArrowDownRight : null"
              v-if="stat.changeType !== 'neutral'"
              :class="cn(
                'size-3.5',
                stat.changeType === 'up' && 'text-surface',
                stat.changeType === 'down' && 'text-destructive',
              )"
            />
            <span
              :class="cn(
                'text-xs font-medium',
                stat.changeType === 'up' && 'text-surface',
                stat.changeType === 'down' && 'text-destructive',
                stat.changeType === 'neutral' && 'text-muted-foreground',
              )"
            >
              {{ stat.change }}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Filters & Search -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div class="relative w-full sm:w-72">
        <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          placeholder="Cari command, user, args..."
          class="pl-8 h-9 text-sm"
        />
      </div>
      <div class="flex items-center gap-2">
        <select
          v-model="categoryFilter"
          class="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <option value="all">All Categories</option>
          <option v-for="cat in categories.filter((c) => c !== 'all')" :key="cat" :value="cat">
            {{ categoryLabel[cat] ?? cat }}
          </option>
        </select>
        <select
          v-model="statusFilter"
          class="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </select>
      </div>
    </div>

    <!-- Command Logs Table -->
    <Card>
      <CardHeader class="flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle class="text-heading">Command Execution Log</CardTitle>
        <span class="text-xs text-muted-foreground">{{ filteredLogs.length }} entries</span>
      </CardHeader>
      <CardContent class="p-0">
        <Table>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead class="pl-6">Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Command</TableHead>
              <TableHead>Arguments</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Response</TableHead>
              <TableHead class="pr-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="filteredLogs.length === 0">
              <TableRow>
                <TableCell colspan="8" class="text-center py-12 text-muted-foreground">
                  <div class="flex flex-col items-center gap-2">
                    <Terminal class="size-8 opacity-40" />
                    <p class="text-sm">No command logs found matching your filters.</p>
                  </div>
                </TableCell>
              </TableRow>
            </template>
            <TableRow v-for="log in filteredLogs" :key="log.id">
              <!-- Time -->
              <TableCell class="pl-6">
                <div class="flex flex-col">
                  <span class="text-xs font-medium text-foreground whitespace-nowrap">{{ formatTime(log.timestamp) }}</span>
                  <span class="text-[10px] text-muted-foreground whitespace-nowrap">{{ timeAgo(log.timestamp) }}</span>
                </div>
              </TableCell>

              <!-- User -->
              <TableCell>
                <div class="flex items-center gap-2.5">
                  <Avatar class="size-8 shrink-0 rounded-full">
                    <AvatarFallback class="rounded-full text-[10px] bg-primary/10 text-primary font-semibold">
                      {{ initials(log.pushName) }}
                    </AvatarFallback>
                  </Avatar>
                  <div class="min-w-0">
                    <span class="text-sm font-medium text-foreground truncate block">
                      {{ log.pushName }}
                    </span>
                    <span class="text-[10px] text-muted-foreground font-mono">
                      {{ log.jid.split('@')[0] }}
                    </span>
                  </div>
                </div>
              </TableCell>

              <!-- Session -->
              <TableCell>
                <span class="text-xs text-foreground">{{ log.session }}</span>
              </TableCell>

              <!-- Command -->
              <TableCell>
                <code class="text-xs font-mono font-semibold text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                  {{ log.command }}
                </code>
              </TableCell>

              <!-- Arguments -->
              <TableCell class="max-w-[180px]">
                <span v-if="log.args" class="text-xs text-muted-foreground truncate block">
                  {{ log.args }}
                </span>
                <span v-else class="text-xs text-muted-foreground/50 italic">—</span>
              </TableCell>

              <!-- Category -->
              <TableCell>
                <Badge
                  :variant="categoryBadgeVariant(log.category)"
                  class="rounded-md text-[10px] px-1.5 py-0"
                >
                  {{ categoryLabel[log.category] ?? log.category }}
                </Badge>
              </TableCell>

              <!-- Response Time -->
              <TableCell>
                <span class="text-xs font-mono font-medium" :class="responseTimeColor(log.responseTime)">
                  {{ formatResponseTime(log.responseTime) }}
                </span>
              </TableCell>

              <!-- Status -->
              <TableCell class="pr-6">
                <div class="flex items-center gap-1.5">
                  <span
                    class="size-2 rounded-full shrink-0"
                    :class="log.status === 'success' ? 'bg-emerald-500' : 'bg-destructive'"
                  ></span>
                  <span class="text-xs" :class="log.status === 'success' ? 'text-emerald-500' : 'text-destructive'">
                    {{ log.status === 'success' ? 'OK' : 'ERR' }}
                  </span>
                </div>
                <p v-if="log.errorMessage" class="text-[10px] text-destructive/80 mt-0.5 truncate max-w-[120px]" :title="log.errorMessage">
                  {{ log.errorMessage }}
                </p>
                <p v-if="log.groupName" class="text-[10px] text-muted-foreground mt-0.5">
                  {{ log.groupName }}
                </p>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
</template>
