export interface OfflineAction {
    id: string;
    type: string;
    payload: any;
    timestamp: number;
}

const CACHE_KEY_PREFIX = 'unistay_cache_';
const QUEUE_KEY = 'unistay_offline_queue';

// 1. Cache Data Locally
export const cacheData = (key: string, data: any): void => {
    try {
        localStorage.setItem(`${CACHE_KEY_PREFIX}${key}`, JSON.stringify(data));
    } catch (error) {
        console.error('Error caching data offline:', error);
    }
};

// 2. Get Cached Data Offline
export const getCachedData = <T>(key: string): T | null => {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${key}`);
    return cached ? JSON.parse(cached) : null;
};

// 3. Queue Action for Sync
export const queueOfflineAction = (type: string, payload: any): OfflineAction => {
    const queue = getOfflineQueue();
    const newAction: OfflineAction = {
        id: Date.now().toString(),
        type,
        payload,
        timestamp: Date.now(),
    };
    queue.push(newAction);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return newAction;
};

// 4. Retrieve Queued Actions
export const getOfflineQueue = (): OfflineAction[] => {
    const queue = localStorage.getItem(QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
};

// 5. Clear Processed Queue
export const clearOfflineQueue = (): void => {
    localStorage.removeItem(QUEUE_KEY);
};

// 6. Automatically Sync when Online
export const syncOfflineData = async (syncCallback: (action: OfflineAction) => Promise<boolean>) => {
    if (!navigator.onLine) return;

    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    const remainingQueue: OfflineAction[] = [];

    for (const action of queue) {
        try {
            const success = await syncCallback(action);
            if (!success) remainingQueue.push(action);
        } catch {
            remainingQueue.push(action);
        }
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
};