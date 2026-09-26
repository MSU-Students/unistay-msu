import { db } from './index';
import { OfflineSyncItem } from '../types';
import apiClient from '../api/client';

class SyncEngine {
  private isSyncing = false;
  private listeners: ((isOnline: boolean, pendingCount: number) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  public onStatusChange(callback: (isOnline: boolean, pendingCount: number) => void) {
    this.listeners.push(callback);
  }

  private async notifyListeners() {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const count = await this.getPendingCount();
    this.listeners.forEach((listener) => listener(isOnline, count));
  }

  public async getPendingCount(): Promise<number> {
    return db.syncQueue.where('status').equals('pending').count();
  }

  public async enqueueMutation(
    action: OfflineSyncItem['action'],
    payload: Record<string, any>,
  ): Promise<string> {
    const clientMutationId = `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db.syncQueue.add({
      clientMutationId,
      action,
      payload,
      queuedAt: new Date().toISOString(),
      status: 'pending',
    });

    await this.notifyListeners();

    // If online, immediately attempt to flush
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.flushQueue();
    }

    return clientMutationId;
  }

  public async flushQueue(): Promise<void> {
    if (this.isSyncing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.isSyncing = true;
    try {
      const pendingItems = await db.syncQueue.where('status').equals('pending').toArray();
      if (pendingItems.length === 0) {
        this.isSyncing = false;
        return;
      }

      // Mark items as syncing
      for (const item of pendingItems) {
        if (item.id) {
          await db.syncQueue.update(item.id, { status: 'syncing' });
        }
      }

      const response = await apiClient.post('/sync/batch', {
        items: pendingItems.map((item) => ({
          clientMutationId: item.clientMutationId,
          action: item.action,
          payload: item.payload,
          queuedAt: item.queuedAt,
        })),
      });

      const { results } = response.data.data;

      // Update status for each result
      for (const res of results) {
        const item = pendingItems.find((p) => p.clientMutationId === res.clientMutationId);
        if (item && item.id) {
          if (res.success) {
            await db.syncQueue.delete(item.id);
          } else {
            await db.syncQueue.update(item.id, {
              status: 'failed',
              error: res.error,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[SyncEngine] Batch sync deferred due to network error:', err);
      // Revert syncing back to pending
      const syncingItems = await db.syncQueue.where('status').equals('syncing').toArray();
      for (const item of syncingItems) {
        if (item.id) {
          await db.syncQueue.update(item.id, { status: 'pending' });
        }
      }
    } finally {
      this.isSyncing = false;
      await this.notifyListeners();
    }
  }

  private handleNetworkChange(isOnline: boolean) {
    if (isOnline) {
      console.log('[SyncEngine] Connectivity restored. Synchronizing offline queue...');
      this.flushQueue();
    } else {
      console.warn('[SyncEngine] Network offline. Operating from local Dexie.js cache.');
    }
    this.notifyListeners();
  }
}

export const syncEngine = new SyncEngine();
