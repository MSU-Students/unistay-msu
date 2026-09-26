import { defineStore } from 'pinia';
import { ref } from 'vue';
import { syncEngine } from '../db/sync-engine';

export const useNetworkStore = defineStore('network', () => {
  const isOnline = ref<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const pendingSyncCount = ref<number>(0);
  const isSyncing = ref<boolean>(false);

  async function updateStatus() {
    pendingSyncCount.value = await syncEngine.getPendingCount();
  }

  // Subscribe to syncEngine status updates
  syncEngine.onStatusChange((onlineStatus, count) => {
    isOnline.value = onlineStatus;
    pendingSyncCount.value = count;
  });

  async function triggerManualSync() {
    isSyncing.value = true;
    try {
      await syncEngine.flushQueue();
    } finally {
      isSyncing.value = false;
      await updateStatus();
    }
  }

  return {
    isOnline,
    pendingSyncCount,
    isSyncing,
    updateStatus,
    triggerManualSync,
  };
});
