<script setup lang="ts">
import { useOfflineSync } from './services/useOfflineSync';

// Automatically monitors connection and processes offline actions when reconnected
const { isOnline } = useOfflineSync(async (action) => {
  console.log('Syncing action:', action);
  return true;
});
</script>

<template>
  <!-- Offline Warning Banner -->
  <div v-if="!isOnline" class="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium sticky top-0 z-50">
    ⚠️ You are currently offline. Changes will sync automatically when reconnected.
  </div>

  <!-- Main App Views -->
  <router-view />
</template>

<style scoped>
/* Add any custom styles here if needed */
</style>