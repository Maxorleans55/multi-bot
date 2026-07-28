<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

defineProps<{
  title?: string
  description?: string
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section :class="cn('space-y-5', $props.class)">
    <div v-if="title || description" class="space-y-1">
      <h3 v-if="title" class="text-sm font-semibold tracking-tight text-foreground">
        {{ title }}
      </h3>
      <p v-if="description" class="text-xs text-muted-foreground">
        {{ description }}
      </p>
    </div>
    <div class="space-y-5">
      <slot />
    </div>
  </section>
</template>
