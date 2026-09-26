import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Facility, FacilityBooking } from '../types';
import apiClient from '../api/client';
import { db } from '../db';
import { syncEngine } from '../db/sync-engine';

export const useFacilitiesStore = defineStore('facilities', () => {
  const facilities = ref<Facility[]>([]);
  const bookings = ref<FacilityBooking[]>([]);
  const loading = ref<boolean>(false);

  async function fetchFacilities(propertyId?: string) {
    loading.value = true;
    try {
      const res = await apiClient.get('/facilities', { params: { propertyId } });
      facilities.value = res.data.data;
    } finally {
      loading.value = false;
    }
  }

  async function fetchMyBookings() {
    try {
      const res = await apiClient.get('/facilities/my-bookings');
      bookings.value = res.data.data;
      await db.bookings.clear();
      await db.bookings.bulkPut(bookings.value);
    } catch (err) {
      bookings.value = await db.bookings.toArray();
    }
  }

  async function createBooking(facilityId: string, startTime: string, endTime: string) {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const payload = { facilityId, startTime, endTime };

    if (isOnline) {
      try {
        const res = await apiClient.post('/facilities/bookings', payload);
        await fetchMyBookings();
        return { online: true, data: res.data.data };
      } catch (err) {
        // Fallback
      }
    }

    const mutationId = await syncEngine.enqueueMutation('CREATE_BOOKING', payload);
    return {
      online: false,
      mutationId,
      message: 'Facility reservation queued in Dexie.js offline store.',
    };
  }

  return {
    facilities,
    bookings,
    loading,
    fetchFacilities,
    fetchMyBookings,
    createBooking,
  };
});
