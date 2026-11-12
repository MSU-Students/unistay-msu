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

  async function fetchTickets(filters?: {
    startDate?: string;
    endDate?: string;
  }) {
    loading.value = true;

    try {
      const res = await apiClient.get('/maintenance/tickets', {
        params: {
          ...(filters?.startDate && { startDate: filters.startDate }),
          ...(filters?.endDate && { endDate: filters.endDate }),
        },
      });

      tickets.value = res.data.data;

      // Update the offline cache only when fetching all tickets
      if (!filters?.startDate && !filters?.endDate) {
        await db.tickets.clear();
        await db.tickets.bulkPut(tickets.value);
      }
    } catch (err) {
      const cachedTickets = await db.tickets.toArray();

      tickets.value = cachedTickets.filter((ticket) => {
        const ticketDate = new Date(ticket.createdAt)
          .toISOString()
          .slice(0, 10);

        if (filters?.startDate && ticketDate < filters.startDate) {
          return false;
        }

        if (filters?.endDate && ticketDate > filters.endDate) {
          return false;
        }

        return true;
      });
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
