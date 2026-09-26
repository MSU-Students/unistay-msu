import { defineStore } from 'pinia';
import { ref } from 'vue';
import { MaintenanceTicket, OutageReport } from '../types';
import apiClient from '../api/client';
import { db } from '../db';
import { syncEngine } from '../db/sync-engine';

export const useMaintenanceStore = defineStore('maintenance', () => {
  const tickets = ref<MaintenanceTicket[]>([]);
  const outages = ref<OutageReport[]>([]);
  const loading = ref<boolean>(false);

  async function fetchTickets() {
    loading.value = true;
    try {
      const res = await apiClient.get('/maintenance/tickets');
      tickets.value = res.data.data;
      await db.tickets.clear();
      await db.tickets.bulkPut(tickets.value);
    } catch (err) {
      tickets.value = await db.tickets.toArray();
    } finally {
      loading.value = false;
    }
  }

  async function fetchOutages() {
    try {
      const res = await apiClient.get('/maintenance/outages');
      outages.value = res.data.data;
    } catch (err) {
      console.warn('[MaintenanceStore] Outages offline');
    }
  }

  async function createTicket(data: {
    title: string;
    description: string;
    category: string;
    priority: string;
    propertyId: string;
    photoUrls?: string[];
  }) {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (isOnline) {
      try {
        const res = await apiClient.post('/maintenance/tickets', data);
        await fetchTickets();
        return { online: true, data: res.data.data };
      } catch (err) {
        // Fallback to offline
      }
    }

    const mutationId = await syncEngine.enqueueMutation('CREATE_TICKET', data);
    return {
      online: false,
      mutationId,
      message: 'Maintenance ticket saved offline in Dexie.js queue.',
    };
  }

  return {
    tickets,
    outages,
    loading,
    fetchTickets,
    fetchOutages,
    createTicket,
  };
});
