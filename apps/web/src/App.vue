<script setup lang="ts">
import { useColorMode } from '@vueuse/core'
import { RouterView } from 'vue-router'

useColorMode({
  selector: 'html',
  attribute: 'class',
  modes: {
    dark: 'dark',
    light: '',
  },
})
</script>

<template>
  <RouterView />
</template>
