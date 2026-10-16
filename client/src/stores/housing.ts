import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  Application,
  HousingApplicationReport,
  HousingApplicationReportFilters,
  Property,
} from '../types';
import apiClient from '../api/client';
import { db } from '../db';

export const useHousingStore = defineStore('housing', () => {
  const properties = ref<Property[]>([]);
  const applications = ref<Application[]>([]);
  const loading = ref<boolean>(false);
  const applicationsLoading = ref<boolean>(false);
  const applicationsError = ref<string | null>(null);
  const adminApplicationReport = ref<HousingApplicationReport | null>(null);
  const adminReportLoading = ref<boolean>(false);
  const adminReportError = ref<string | null>(null);
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
    applicationsLoading.value = true;
    applicationsError.value = null;
    try {
      const res = await apiClient.get('/housing/my-applications');
      applications.value = res.data.data;
    } catch (err) {
      applicationsError.value =
        err instanceof Error ? err.message : 'Unable to load your applications. Please try again.';
    } finally {
      applicationsLoading.value = false;
    }
  }

  async function fetchAdminApplicationReport(filters: HousingApplicationReportFilters = {}) {
    adminReportLoading.value = true;
    adminReportError.value = null;
    try {
      const res = await apiClient.get('/housing/admin/application-report', { params: filters });
      adminApplicationReport.value = res.data.data;
    } catch (err) {
      adminReportError.value =
        err instanceof Error
          ? err.message
          : 'Unable to load the housing application report. Please try again.';
    } finally {
      adminReportLoading.value = false;
    }
  }

  async function updateApplicationCompliance(
    id: string,
    data: {
      policyException: boolean;
      policyExceptionReason?: string;
      escalated: boolean;
      escalationReason?: string;
    },
    filters: HousingApplicationReportFilters = {},
  ) {
    const res = await apiClient.patch(`/housing/applications/${id}/compliance`, data);
    await fetchAdminApplicationReport(filters);
    return res.data.data;
  }

  return {
    properties,
    applications,
    loading,
    applicationsLoading,
    applicationsError,
    adminApplicationReport,
    adminReportLoading,
    adminReportError,
    selectedProperty,
    fetchProperties,
    fetchPropertyById,
    submitApplication,
    fetchMyApplications,
    fetchAdminApplicationReport,
    updateApplicationCompliance,
  };
});
