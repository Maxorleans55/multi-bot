<script setup lang="ts">
import StatsCards from '@/components/dashboard/StatsCards.vue'
import SessionTable from '@/components/dashboard/SessionTable.vue'
import RecentActivity from '@/components/dashboard/RecentActivity.vue'
</script>

<template>
  <div class="space-y-7">
    <!-- Page Header -->
    <div>
      <h2 class="text-display text-foreground">Dashboard</h2>
      <p class="text-body text-muted-foreground mt-1">
        Monitor your WhatsApp bot sessions, messages, and AI activity.
      </p>
    </div>

    <!-- Stats Cards -->
    <StatsCards />

    <!-- Session Table + Activity Feed Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6">
      <div class="lg:col-span-2">
        <SessionTable />
      </div>
      <div>
        <RecentActivity />
      </div>
    </div>
  </div>
</template>
