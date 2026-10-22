import { ref, onMounted, onUnmounted } from 'vue';
import { syncOfflineData, OfflineAction } from './offlineSync';

export function useOfflineSync(onSyncAction?: (action: OfflineAction) => Promise<boolean>) {
    const isOnline = ref<boolean>(navigator.onLine);

    const updateOnlineStatus = () => {
        isOnline.value = navigator.onLine;
        if (isOnline.value && onSyncAction) {
            syncOfflineData(onSyncAction);
        }
    };

    onMounted(() => {
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
    });

    onUnmounted(() => {
        window.removeEventListener('online', updateOnlineStatus);
        window.removeEventListener('offline', updateOnlineStatus);
    });

    return { isOnline };
}