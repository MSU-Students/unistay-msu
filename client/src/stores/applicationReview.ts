import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ApplicationStatus, ManagerApplication } from '../types';
import {
  fetchManagerApplications,
  requestMoreInformation,
  saveInternalReviewNotes,
  setApplicationStatus,
} from '../services/applicationReview';

export const useApplicationReviewStore = defineStore('applicationReview', () => {
  const applications = ref<ManagerApplication[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedApplicationId = ref<string | null>(null);
  const selectedApplication = computed(
    () => applications.value.find((application) => application.id === selectedApplicationId.value) ?? null,
  );

  async function loadApplications() {
    loading.value = true;
    error.value = null;
    try {
      applications.value = await fetchManagerApplications();
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Unable to load applications.';
      throw cause;
    } finally {
      loading.value = false;
    }
  }

  function selectApplication(id: string | null) {
    selectedApplicationId.value = id;
  }

  function updateApplication(updated: ManagerApplication) {
    const index = applications.value.findIndex((application) => application.id === updated.id);
    if (index === -1) {
      throw new Error('The application is no longer available in the review list.');
    }
    applications.value[index] = updated;
  }

  async function changeStatus(id: string, status: Extract<ApplicationStatus, 'approved' | 'rejected'>) {
    updateApplication(await setApplicationStatus(id, status));
  }

  async function saveNotes(id: string, notes: string) {
    updateApplication(await saveInternalReviewNotes(id, notes));
  }

  async function requestInformation(id: string, message: string) {
    updateApplication(await requestMoreInformation(id, message));
  }

  return {
    applications,
    loading,
    error,
    selectedApplicationId,
    selectedApplication,
    loadApplications,
    selectApplication,
    changeStatus,
    saveNotes,
    requestInformation,
  };
});
