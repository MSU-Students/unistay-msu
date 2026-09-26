<script setup lang="ts">
import { useNetworkStore } from '../../stores/network';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-vue-next';

const networkStore = useNetworkStore();
</script>

<template>
  <div>
    <!-- Offline Alert -->
    <div
      v-if="!networkStore.isOnline"
      class="bg-amber-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-sm transition-all duration-300"
    >
      <div class="flex items-center space-x-2.5">
        <WifiOff class="w-4 h-4 text-amber-200 animate-pulse" />
        <span class="font-medium">
          Offline Mode Active — You are using local IndexedDB (Dexie.js).
        </span>
        <span v-if="networkStore.pendingSyncCount > 0" class="bg-amber-800 px-2 py-0.5 rounded-full text-xs font-semibold">
          {{ networkStore.pendingSyncCount }} pending mutation(s) queued
        </span>
      </div>
      <span class="text-xs text-amber-100 hidden sm:inline">Changes will automatically sync when connection returns</span>
    </div>

    <!-- Reconnected Syncing Alert -->
    <div
      v-else-if="networkStore.pendingSyncCount > 0"
      class="bg-emerald-700 text-white px-4 py-2 shadow-sm flex items-center justify-between text-sm"
    >
      <div class="flex items-center space-x-2">
        <RefreshCw class="w-4 h-4 animate-spin text-emerald-200" />
        <span>Connected. Replaying {{ networkStore.pendingSyncCount }} offline mutations to PostgreSQL...</span>
      </div>
      <button
        @click="networkStore.triggerManualSync"
        :disabled="networkStore.isSyncing"
        class="text-xs bg-emerald-800 hover:bg-emerald-900 text-emerald-100 px-3 py-1 rounded transition-colors disabled:opacity-50"
      >
        Sync Now
      </button>
    </div>
  </div>
</template>
