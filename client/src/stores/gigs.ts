import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Gig } from '../types';
import apiClient from '../api/client';
import { db } from '../db';
import { syncEngine } from '../db/sync-engine';

export const useGigsStore = defineStore('gigs', () => {
  const gigs = ref<Gig[]>([]);
  const loading = ref<boolean>(false);

  async function fetchGigs(category?: string) {
    loading.value = true;
    try {
      const res = await apiClient.get('/gigs', { params: { category } });
      gigs.value = res.data.data;
      await db.gigs.clear();
      await db.gigs.bulkPut(gigs.value);
    } catch (err) {
      gigs.value = await db.gigs.toArray();
    } finally {
      loading.value = false;
    }
  }

  async function createGig(data: {
    title: string;
    description: string;
    category: string;
    compensationAmount: number;
    locationNote?: string;
  }) {
    const res = await apiClient.post('/gigs', data);
    await fetchGigs();
    return res.data.data;
  }

  async function applyForGig(gigId: string, pitch?: string) {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const payload = { gigId, pitch };

    if (isOnline) {
      try {
        const res = await apiClient.post(`/gigs/${gigId}/apply`, { pitch });
        return { online: true, data: res.data.data };
      } catch (err) {
        // Fallback
      }
    }

    const mutationId = await syncEngine.enqueueMutation('CREATE_GIG_APPLICATION', payload);
    return {
      online: false,
      mutationId,
      message: 'Gig application queued in Dexie.js offline store.',
    };
  }

  return {
    gigs,
    loading,
    fetchGigs,
    createGig,
    applyForGig,
  };
});
