<script setup lang="ts">
import { ArrowDownRight, ArrowUpRight, Bot, MessageSquareText, Phone, Users, type LucideIcon } from '@lucide/vue'
import Card from '@/components/ui/card/Card.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import { cn } from '@/lib/utils'

interface StatCardData {
  label: string
  value: string | number
  icon: LucideIcon
  change: string
  changeType: 'up' | 'down' | 'neutral'
}

const stats: StatCardData[] = [
  { label: 'Active Sessions', value: 3, icon: Phone, change: '+1 from last week', changeType: 'up' },
  { label: 'Registered Users', value: 247, icon: Users, change: '+12 today', changeType: 'up' },
  { label: 'Messages Processed', value: '8,421', icon: MessageSquareText, change: '+342 today', changeType: 'up' },
  { label: 'AI Calls Today', value: 156, icon: Bot, change: '-8% vs yesterday', changeType: 'down' },
]
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Card v-for="stat in stats" :key="stat.label">
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
</template>
