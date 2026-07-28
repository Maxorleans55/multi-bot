<script setup lang="ts">
import { cn } from '@/lib/utils'
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Table from '@/components/ui/table/Table.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import TableCell from '@/components/ui/table/TableCell.vue'

interface Session {
  id: string
  phoneNumber: string
  pushName: string
  status: 'connected' | 'connecting' | 'disconnected' | 'pairing'
  uptime: string
  messagesIn: number
  messagesOut: number
  aiMode: boolean
  platform: string
}

const sessions: Session[] = [
  { id: 'session-01', phoneNumber: '6281234567890', pushName: 'Wahyu', status: 'connected', uptime: '3h 42m', messagesIn: 341, messagesOut: 89, aiMode: true, platform: 'android' },
  { id: 'session-02', phoneNumber: '6289876543210', pushName: 'Bot Support', status: 'connected', uptime: '7h 15m', messagesIn: 612, messagesOut: 204, aiMode: true, platform: 'ios' },
  { id: 'session-03', phoneNumber: '6281112223334', pushName: 'Shop Bot', status: 'disconnected', uptime: '—', messagesIn: 0, messagesOut: 0, aiMode: false, platform: 'web' },
  { id: 'session-04', phoneNumber: '6284445556667', pushName: 'Test Session', status: 'connecting', uptime: '—', messagesIn: 0, messagesOut: 0, aiMode: false, platform: 'android' },
  { id: 'session-05', phoneNumber: '6287778889990', pushName: 'Premium Bot', status: 'pairing', uptime: '—', messagesIn: 0, messagesOut: 0, aiMode: true, platform: 'ios' },
]

const statusVariant = (status: Session['status']): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const map: Record<Session['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
    connected: 'default',
    connecting: 'secondary',
    disconnected: 'destructive',
    pairing: 'outline',
  }
  return map[status]
}

const statusDotClass = (status: Session['status']): string => {
  const map: Record<Session['status'], string> = {
    connected: 'bg-emerald-500',
    connecting: 'bg-amber-500 animate-pulse',
    disconnected: 'bg-red-500',
    pairing: 'bg-blue-500 animate-pulse',
  }
  return map[status]
}
</script>

<template>
  <Card>
    <CardHeader class="flex-row items-center justify-between space-y-0 pb-4">
      <CardTitle class="text-heading">WhatsApp Sessions</CardTitle>
      <span class="text-xs text-muted-foreground">{{ sessions.length }} sessions</span>
    </CardHeader>
    <CardContent class="p-0">
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="pl-6">Session</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Uptime</TableHead>
            <TableHead>In / Out</TableHead>
            <TableHead>AI Mode</TableHead>
            <TableHead class="pr-6">Platform</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="session in sessions" :key="session.id">
            <TableCell class="pl-6">
              <div class="flex flex-col">
                <span class="text-sm font-medium text-foreground">{{ session.pushName }}</span>
                <span class="text-xs text-muted-foreground">{{ session.phoneNumber }}</span>
              </div>
            </TableCell>
            <TableCell>
              <Badge :variant="statusVariant(session.status)" class="gap-1.5 rounded-md">
                <span class="size-2 rounded-full" :class="statusDotClass(session.status)"></span>
                {{ session.status }}
              </Badge>
            </TableCell>
            <TableCell class="font-mono text-xs text-muted-foreground">{{ session.uptime }}</TableCell>
            <TableCell class="font-mono text-xs">
              <span class="text-surface font-medium">{{ session.messagesIn }}</span>
              <span class="text-muted-foreground"> / </span>
              <span class="text-primary font-medium">{{ session.messagesOut }}</span>
            </TableCell>
            <TableCell>
              <Badge v-if="session.aiMode" variant="secondary" class="rounded-md">
                active
              </Badge>
              <span v-else class="text-xs text-muted-foreground">—</span>
            </TableCell>
            <TableCell class="pr-6">
              <span class="text-xs capitalize text-muted-foreground">{{ session.platform }}</span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent>
  </Card>
</template>
