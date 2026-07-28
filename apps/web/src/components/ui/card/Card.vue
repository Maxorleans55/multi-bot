<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="card"
    :class="
      cn(
        'bg-card text-card-foreground flex flex-col gap-6 rounded-md border py-6 shadow-sm',
        props.class,
      )
    "
  >
    <ScrollArea class="flex-1 min-h-0">
      <slot />
    </ScrollArea>
  </div>
</template>
