<script setup lang="ts">
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Activity {
  id: string
  type: 'message' | 'command' | 'ai' | 'session' | 'download' | 'error'
  session: string
  detail: string
  user: string
  time: string
  group?: string
}

const activities: Activity[] = [
  { id: 'a1', type: 'message', session: 'Wahyu', detail: 'Incoming message from group "Keluarga Bahagia"', user: '6281234567890', time: '2 min ago', group: 'Keluarga Bahagia' },
  { id: 'a2', type: 'command', session: 'Bot Support', detail: 'Command executed: !ping', user: '6289876543210', time: '5 min ago' },
  { id: 'a3', type: 'ai', session: 'Bot Support', detail: 'AI replied to group mention in "Tech Discussion"', user: '6289876543210', time: '8 min ago', group: 'Tech Discussion' },
  { id: 'a4', type: 'download', session: 'Wahyu', detail: 'Downloaded Instagram reel', user: '6283334445556', time: '12 min ago' },
  { id: 'a5', type: 'session', session: 'Shop Bot', detail: 'Session disconnected — reconnecting...', user: '—', time: '18 min ago' },
  { id: 'a6', type: 'error', session: 'Shop Bot', detail: 'Connection timeout after 30s', user: '—', time: '19 min ago' },
  { id: 'a7', type: 'command', session: 'Wahyu', detail: 'Command executed: !sticker', user: '6285556667778', time: '22 min ago' },
  { id: 'a8', type: 'ai', session: 'Wahyu', detail: 'AI mode chat — 4 messages exchanged', user: '6284443332221', time: '25 min ago' },
  { id: 'a9', type: 'message', session: 'Bot Support', detail: 'Incoming message from group "Project Alpha"', user: '6281110009998', time: '30 min ago', group: 'Project Alpha' },
  { id: 'a10', type: 'download', session: 'Bot Support', detail: 'Downloaded YouTube audio (mp3)', user: '6282221110007', time: '34 min ago' },
  { id: 'a11', type: 'session', session: 'Premium Bot', detail: 'QR pairing initiated', user: '—', time: '40 min ago' },
  { id: 'a12', type: 'command', session: 'Premium Bot', detail: 'Command executed: !help', user: '6287778889990', time: '45 min ago' },
]

const typeBadge = (type: Activity['type']): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
  const map: Record<Activity['type'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    message: { label: 'MSG', variant: 'secondary' },
    command: { label: 'CMD', variant: 'outline' },
    ai: { label: 'AI', variant: 'default' },
    session: { label: 'SYS', variant: 'secondary' },
    download: { label: 'DL', variant: 'outline' },
    error: { label: 'ERR', variant: 'destructive' },
  }
  return map[type]
}
</script>

<template>
  <Card>
    <CardHeader class="flex-row items-center justify-between space-y-0 pb-4">
      <CardTitle class="text-heading">Recent Activity</CardTitle>
      <span class="text-xs text-muted-foreground">Last 60 minutes</span>
    </CardHeader>
    <CardContent class="p-0">
      <ScrollArea class="max-h-[520px]">
        <div
          v-for="activity in activities"
          :key="activity.id"
          class="flex items-start gap-3 border-t border-border px-5 py-3 first:border-t-0 hover:bg-muted/40 transition-design"
        >
          <Badge :variant="typeBadge(activity.type).variant" class="mt-0.5 shrink-0 px-1.5 text-[10px] font-bold rounded-sm">
            {{ typeBadge(activity.type).label }}
          </Badge>
          <div class="min-w-0 flex-1">
            <p class="text-sm truncate text-foreground/90">{{ activity.detail }}</p>
            <p class="text-xs text-muted-foreground mt-0.5">
              <span class="font-medium text-foreground">{{ activity.session }}</span>
              <template v-if="activity.group">
                &nbsp;&middot;&nbsp;{{ activity.group }}
              </template>
            </p>
          </div>
          <span class="text-[11px] text-muted-foreground shrink-0 mt-0.5">{{ activity.time }}</span>
        </div>
      </ScrollArea>
    </CardContent>
  </Card>
</template>
