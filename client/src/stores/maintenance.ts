import { defineStore } from 'pinia';
import { ref } from 'vue';
import { MaintenanceTicket, OutageReport } from '../types';
import apiClient from '../api/client';
import { db } from '../db';
import { syncEngine } from '../db/sync-engine';

export interface CreateTicketPayload {
  title: string;
  description: string;
  category: string;
  priority: string;
  propertyId: string;
  unitId?: string;
  photoUrls?: string[];
}

export const useMaintenanceStore = defineStore('maintenance', () => {
  const tickets = ref<MaintenanceTicket[]>([]);
  const outages = ref<OutageReport[]>([]);
  const loading = ref<boolean>(false);
  const isInitialLoaded = ref<boolean>(false);

  async function fetchTickets() {
    // 1. Instant hydration from local Dexie store to eliminate flickering
    if (tickets.value.length === 0) {
      const cached = await db.tickets.toArray();
      if (cached && cached.length > 0) {
        tickets.value = cached.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
    }

    try {
      const res = await apiClient.get('/maintenance/tickets');
      if (res.data?.data) {
        tickets.value = res.data.data;
        await db.tickets.bulkPut(res.data.data);
      }
    } catch (err) {
      console.warn('[MaintenanceStore] Fetch tickets offline, loading from Dexie');
      const cached = await db.tickets.toArray();
      if (cached && cached.length > 0) {
        tickets.value = cached;
      }
    } finally {
      loading.value = false;
      isInitialLoaded.value = true;
    }
  }

  async function fetchOutages() {
    try {
      const res = await apiClient.get('/maintenance/outages');
      outages.value = res.data.data || [];
    } catch (err) {
      console.warn('[MaintenanceStore] Outages offline');
    }
  }

  /**
   * Upload photo to MinIO when online or convert to base64 Data URL when offline.
   */
  async function uploadPhoto(file: File): Promise<string> {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (isOnline) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiClient.post('/storage/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data?.data?.url) {
          return res.data.data.url;
        }
      } catch (err) {
        console.warn('[MaintenanceStore] Online photo upload failed, converting to local preview base64:', err);
      }
    }

    // Fallback: convert to base64 data URL for offline storage
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  async function createTicket(data: CreateTicketPayload) {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (isOnline) {
      try {
        const res = await apiClient.post('/maintenance/tickets', data);
        const createdTicket: MaintenanceTicket = res.data.data;

        // Immediately prepend to tickets so the card is visible instantly without delay
        tickets.value = [createdTicket, ...tickets.value.filter(t => t.id !== createdTicket.id)];
        await db.tickets.put(createdTicket);

        return {
          online: true,
          ticket: createdTicket,
          message: 'Maintenance ticket submitted successfully.',
        };
      } catch (err: any) {
        console.warn('[MaintenanceStore] API ticket creation failed, enqueuing offline mutation:', err);
      }
    }

    // Enqueue mutation in Dexie.js sync queue
    const mutationId = await syncEngine.enqueueMutation('CREATE_TICKET', data);

    // Create optimistic local ticket to display in UI immediately
    const optimisticTicket: MaintenanceTicket = {
      id: `offline-${Date.now()}`,
      title: data.title,
      description: data.description,
      category: data.category as any,
      priority: data.priority as any,
      status: 'open',
      photoUrls: data.photoUrls,
      property: {
        id: data.propertyId,
        name: 'Assigned Residence',
        type: 'institutional_dorm',
        description: '',
        address: 'MSU Campus',
        minMonthlyRate: 0,
        maxMonthlyRate: 0,
        isAccredited: true,
      },
      reporter: {
        id: 'me',
        email: 'student@msu.edu.ph',
        fullName: 'Current Student',
        role: 'student',
      },
      createdAt: new Date().toISOString(),
    };

    tickets.value.unshift(optimisticTicket);
    await db.tickets.put(optimisticTicket);

    return {
      online: false,
      mutationId,
      ticket: optimisticTicket,
      message: 'Maintenance ticket saved offline in Dexie.js queue. It will automatically synchronize when connectivity is restored.',
    };
  }

  return {
    tickets,
    outages,
    loading,
    isInitialLoaded,
    fetchTickets,
    fetchOutages,
    uploadPhoto,
    createTicket,
  };
});
