import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Property, Application } from '../types';
import apiClient from '../api/client';
import { db } from '../db';

export const useHousingStore = defineStore('housing', () => {
  const properties = ref<Property[]>([]);
  const applications = ref<Application[]>([]);
  const loading = ref<boolean>(false);
  const selectedProperty = ref<Property | null>(null);

  async function fetchProperties(filter?: { type?: string; maxPrice?: number }) {
    loading.value = true;
    try {
      const res = await apiClient.get('/housing/properties', { params: filter });
      properties.value = res.data.data;
      // Cache in Dexie for offline lookup
      await db.properties.clear();
      await db.properties.bulkPut(properties.value);
    } catch (err) {
      console.warn('[HousingStore] API unreachable, loading properties from Dexie offline cache...');
      properties.value = await db.properties.toArray();
    } finally {
      loading.value = false;
    }
  }

  async function fetchPropertyById(id: string) {
    loading.value = true;
    try {
      const res = await apiClient.get(`/housing/properties/${id}`);
      selectedProperty.value = res.data.data;
    } catch (err) {
      selectedProperty.value = (await db.properties.get(id)) || null;
    } finally {
      loading.value = false;
    }
  }

  async function submitApplication(propertyId: string, remarks?: string) {
    const res = await apiClient.post('/housing/applications', { propertyId, remarks });
    return res.data.data;
  }

  async function fetchMyApplications() {
    try {
      const res = await apiClient.get('/housing/my-applications');
      applications.value = res.data.data;
    } catch (err) {
      console.warn('[HousingStore] Unable to fetch applications online');
    }
  }

  return {
    properties,
    applications,
    loading,
    selectedProperty,
    fetchProperties,
    fetchPropertyById,
    submitApplication,
    fetchMyApplications,
  };
});
