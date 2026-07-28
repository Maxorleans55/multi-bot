<script setup lang="ts">
import {
  Bot,
  Command,
  Download,
  LayoutDashboard,
  MessageSquareText,
  Phone,
  Settings,
  Users,
  type LucideIcon,
} from '@lucide/vue'
import { useRoute } from 'vue-router'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import AvatarFallback from '@/components/ui/avatar/AvatarFallback.vue'

interface NavItem {
  title: string
  icon: LucideIcon
  route: string
}

const mainItems: NavItem[] = [
  { title: 'Dashboard', icon: LayoutDashboard, route: '/' },
  { title: 'Sessions', icon: Phone, route: '/sessions' },
  { title: 'Users', icon: Users, route: '/users' },
  { title: 'Chat Logs', icon: MessageSquareText, route: '/ai-logs' },
]

const toolsItems: NavItem[] = [
  { title: 'Command Logs', icon: Command, route: '/command-logs' },
  { title: 'Media Downloads', icon: Download, route: '/downloads' },
]

const systemItems: NavItem[] = [
  { title: 'Settings', icon: Settings, route: '/settings' },
]

const route = useRoute()

const isActive = (itemRoute: string): boolean => {
  if (itemRoute === '/') return route.path === '/'
  return route.path.startsWith(itemRoute)
}
</script>

<template>
  <Sidebar collapsible="icon" variant="sidebar">
    <!-- Header -->
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" as-child>
            <RouterLink to="/">
              <div class="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <Bot class="size-4" />
              </div>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-semibold">Bot-Baileys-AI</span>
                <span class="truncate text-xs text-muted-foreground">Dashboard</span>
              </div>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>

    <!-- Main Nav -->
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Monitoring</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in mainItems" :key="item.title">
              <SidebarMenuButton as-child :is-active="isActive(item.route)" :tooltip="item.title">
                <RouterLink :to="item.route">
                  <component :is="item.icon" />
                  <span>{{ item.title }}</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Tools</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in toolsItems" :key="item.title">
              <SidebarMenuButton as-child :is-active="isActive(item.route)" :tooltip="item.title">
                <RouterLink :to="item.route">
                  <component :is="item.icon" />
                  <span>{{ item.title }}</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>System</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in systemItems" :key="item.title">
              <SidebarMenuButton as-child :is-active="isActive(item.route)" :tooltip="item.title">
                <RouterLink :to="item.route">
                  <component :is="item.icon" />
                  <span>{{ item.title }}</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <!-- Footer -->
    <SidebarFooter class="border-t border-border">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="sm" as-child>
            <div class="flex items-center gap-2">
              <Avatar class="size-6 rounded-md">
                <AvatarFallback class="rounded-md text-[10px] bg-surface/10 text-surface">WA</AvatarFallback>
              </Avatar>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-medium">Bot Online</span>
                <span class="truncate text-xs text-muted-foreground">v2.0.0</span>
              </div>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
</template>
