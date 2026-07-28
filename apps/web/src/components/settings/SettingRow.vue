<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  label: string
  description?: string
  htmlFor?: string
  /** Put label above control (default) instead of side-by-side */
  stacked?: boolean
  class?: HTMLAttributes['class']
}>(), {
  stacked: true,
})
</script>

<template>
  <div
    :class="
      cn(
        'space-y-2',
        !props.stacked && 'sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-start sm:gap-6 sm:space-y-0',
        props.class,
      )
    "
  >
    <div>
      <label
        v-if="props.htmlFor"
        :for="props.htmlFor"
        class="block text-sm font-medium leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {{ props.label }}
      </label>
      <span v-else class="block text-sm font-medium leading-snug">
        {{ props.label }}
      </span>
      <p v-if="props.description" class="mt-1 text-xs leading-relaxed text-muted-foreground">
        {{ props.description }}
      </p>
    </div>
    <div class="w-full">
      <slot />
    </div>
  </div>
</template>
