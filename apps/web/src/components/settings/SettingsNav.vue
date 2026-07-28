<script setup lang="ts">
import type { Component } from 'vue'
import { cn } from '@/lib/utils'

interface SettingsSection {
  id: string
  title: string
  icon: Component
}

defineProps<{
  sections: SettingsSection[]
  activeId: string
}>()

const emits = defineEmits<{
  (e: 'select', id: string): void
}>()

function handleClick(id: string): void {
  emits('select', id)
}
</script>

<template>
  <aside class="w-full md:w-64 md:shrink-0 md:sticky md:top-4">
    <nav
      class="rounded-md border border-border bg-card p-2"
      aria-label="Settings navigation"
    >
      <ul class="flex flex-col gap-0.5">
        <li v-for="section in sections" :key="section.id">
          <button
            type="button"
            :class="
              cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-design',
                activeId === section.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            "
            @click="handleClick(section.id)"
          >
            <component
              :is="section.icon"
              :class="
                cn(
                  'size-4 shrink-0 transition-design',
                  activeId === section.id ? 'text-primary' : 'text-muted-foreground',
                )
              "
            />
            <span class="truncate text-left">{{ section.title }}</span>
          </button>
        </li>
      </ul>
    </nav>
  </aside>
</template>
