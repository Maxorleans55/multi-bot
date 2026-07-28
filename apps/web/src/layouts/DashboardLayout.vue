<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import Separator from '@/components/ui/separator/Separator.vue'
import { ScrollArea } from '@/components/ui/scroll-area'
</script>

<template>
  <SidebarProvider class="h-svh overflow-hidden">
    <AppSidebar />

    <SidebarInset class="overflow-hidden">
      <header class="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 bg-sidebar">
        <SidebarTrigger class="-ml-1 text-muted-foreground hover:text-foreground transition-design" />
        <Separator orientation="vertical" class="mr-2 h-5 bg-border" />
        <span class="text-heading text-foreground/90">Bot-Baileys-AI</span>
      </header>

      <ScrollArea class="flex-1 min-h-0">
        <div class="space-y-6 p-6 pt-5">
          <RouterView />
        </div>
      </ScrollArea>
    </SidebarInset>
  </SidebarProvider>
</template>
