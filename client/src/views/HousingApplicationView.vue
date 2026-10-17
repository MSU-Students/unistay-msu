<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import AppLayout from '../components/layout/AppLayout.vue';
import { useAuthStore } from '../stores/auth';
import { useHousingStore } from '../stores/housing';
import type { Property } from '../types';

interface HousingApplicationDraft {
  version: 1;
  propertyId: string;
  college: string;
  degreeProgram: string;
  yearLevel: string;
  remarks: string;
}

type ApplicationField = keyof Pick<
  HousingApplicationDraft,
  'propertyId' | 'college' | 'degreeProgram' | 'yearLevel'
>;

const route = useRoute();
const authStore = useAuthStore();
const housingStore = useHousingStore();

const propertyId = ref('');
const college = ref('');
const degreeProgram = ref('');
const yearLevel = ref('');
const remarks = ref('');
const errors = ref<Partial<Record<ApplicationField, string>>>({});
const isSubmitting = ref(false);
const draftMessage = ref('');
const successMessage = ref('');
const errorMessage = ref('');
const draftRestored = ref(false);

const isStudent = computed(() => authStore.user?.role === 'student');
const selectedProperty = computed<Property | undefined>(() =>
  housingStore.properties.find((property) => property.id === propertyId.value),
);

function getDraftKey(): string {
  const userId = authStore.user?.id;
  if (!userId) {
    throw new Error('Your account profile is unavailable, so a draft cannot be saved.');
  }
  return `unistay_housing_application_draft_${userId}`;
}

function isApplicationDraft(value: unknown): value is HousingApplicationDraft {
  if (typeof value !== 'object' || value === null) return false;
  const draft = value as Record<string, unknown>;
  return (
    draft.version === 1 &&
    typeof draft.propertyId === 'string' &&
    typeof draft.college === 'string' &&
    typeof draft.degreeProgram === 'string' &&
    typeof draft.yearLevel === 'string' &&
    typeof draft.remarks === 'string'
  );
}

function restoreDraft(): void {
  if (!isStudent.value) return;

  try {
    const saved = localStorage.getItem(getDraftKey());
    if (!saved) return;

    const draft: unknown = JSON.parse(saved);
    if (!isApplicationDraft(draft)) {
      draftMessage.value = 'The saved draft could not be read. You can start a new application.';
      return;
    }

    propertyId.value = draft.propertyId;
    college.value = draft.college;
    degreeProgram.value = draft.degreeProgram;
    yearLevel.value = draft.yearLevel;
    remarks.value = draft.remarks;
    draftRestored.value = true;
  } catch (error) {
    draftMessage.value = error instanceof Error
      ? `Unable to restore the draft from this device: ${error.message}`
      : 'Unable to restore the draft from this device.';
  }
}

onMounted(async () => {
  restoreDraft();
  await housingStore.fetchProperties();

  if (!draftRestored.value && typeof route.query.propertyId === 'string') {
    propertyId.value = route.query.propertyId;
  }
});

function validate(): boolean {
  const fieldErrors: Partial<Record<ApplicationField, string>> = {};

  if (!propertyId.value) fieldErrors.propertyId = 'Choose a housing facility.';
  else if (!selectedProperty.value) fieldErrors.propertyId = 'Choose a facility from the available directory.';
  if (!college.value.trim()) fieldErrors.college = 'Enter your college or department.';
  if (!degreeProgram.value.trim()) fieldErrors.degreeProgram = 'Enter your degree program.';
  if (!yearLevel.value) fieldErrors.yearLevel = 'Choose your current year level.';

  errors.value = fieldErrors;
  return Object.keys(fieldErrors).length === 0;
}

function clearError(field: ApplicationField): void {
  delete errors.value[field];
}

function getDraft(): HousingApplicationDraft {
  return {
    version: 1,
    propertyId: propertyId.value,
    college: college.value.trim(),
    degreeProgram: degreeProgram.value.trim(),
    yearLevel: yearLevel.value,
    remarks: remarks.value.trim(),
  };
}

function saveDraft(): void {
  draftMessage.value = '';
  successMessage.value = '';
  errorMessage.value = '';

  try {
    localStorage.setItem(getDraftKey(), JSON.stringify(getDraft()));
    draftMessage.value = 'Draft saved on this device only. It has not been submitted to UniStay.';
  } catch (error) {
    draftMessage.value = error instanceof Error
      ? `Unable to save the draft on this device: ${error.message}`
      : 'Unable to save the draft on this device.';
  }
}

function getSubmissionError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message: unknown = error.response?.data?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
      return message.join(' ');
    }
    if (!error.response) {
      return 'Unable to reach the application service. Check your connection and try again.';
    }
  }
  return error instanceof Error
    ? error.message
    : 'Your application could not be submitted. Please try again.';
}

async function submitApplication(): Promise<void> {
  if (isSubmitting.value) return;

  successMessage.value = '';
  errorMessage.value = '';
  draftMessage.value = '';

  if (!isStudent.value) {
    errorMessage.value = 'Housing applications are available to student accounts only.';
    return;
  }

  if (!validate()) return;

  const applicationRemarks = [
    `College/Department: ${college.value.trim()}`,
    `Degree program: ${degreeProgram.value.trim()}`,
    `Year level: ${yearLevel.value}`,
    remarks.value.trim() ? `Additional details: ${remarks.value.trim()}` : '',
  ].filter(Boolean).join('\n');

  isSubmitting.value = true;
  try {
    await housingStore.submitApplication(propertyId.value, applicationRemarks);
    successMessage.value = 'Your housing application was submitted successfully.';

    try {
      localStorage.removeItem(getDraftKey());
    } catch (error) {
      draftMessage.value = error instanceof Error
        ? `Application submitted, but the saved local draft could not be removed: ${error.message}`
        : 'Application submitted, but the saved local draft could not be removed.';
    }

    propertyId.value = '';
    college.value = '';
    degreeProgram.value = '';
    yearLevel.value = '';
    remarks.value = '';
    errors.value = {};
    draftRestored.value = false;
  } catch (error) {
    errorMessage.value = getSubmissionError(error);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <AppLayout>
    <div class="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 class="text-2xl font-bold text-slate-900">Housing Application</h1>
        <p class="mt-1 text-sm text-slate-600">
          Select a facility and provide your academic details to apply for student housing.
        </p>
      </header>

      <div
        v-if="successMessage"
        role="status"
        class="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
      >
        {{ successMessage }}
      </div>
      <div
        v-if="errorMessage"
        role="alert"
        class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      >
        {{ errorMessage }}
      </div>
      <div
        v-if="draftMessage"
        role="status"
        class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"
      >
        {{ draftMessage }}
      </div>
      <div
        v-if="draftRestored"
        role="status"
        class="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600"
      >
        A previously saved draft was restored from this device.
      </div>

      <div
        v-if="!isStudent"
        role="alert"
        class="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
      >
        This application form is available to signed-in student accounts.
      </div>

      <form
        v-else
        novalidate
        class="space-y-6"
        @submit.prevent="submitApplication"
      >
        <section class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <h2 class="text-base font-bold text-slate-900">Personal Information</h2>
            <p class="mt-1 text-xs text-slate-500">
              Your application will use the identity on your signed-in account.
            </p>
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span class="mb-1 block text-sm font-medium text-slate-700">Full name</span>
              <p class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
                {{ authStore.user?.fullName || 'Account name unavailable' }}
              </p>
            </div>
            <div>
              <span class="mb-1 block text-sm font-medium text-slate-700">Email address</span>
              <p class="break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
                {{ authStore.user?.email || 'Account email unavailable' }}
              </p>
            </div>
          </div>
        </section>

        <section class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <h2 class="text-base font-bold text-slate-900">Academic Information</h2>
            <p class="mt-1 text-xs text-slate-500">Fields marked required are needed to submit.</p>
          </div>

          <div>
            <label for="college" class="mb-1 block text-sm font-medium text-slate-700">
              College or department <span class="text-red-700">(required)</span>
            </label>
            <input
              id="college"
              v-model="college"
              type="text"
              autocomplete="organization"
              maxlength="120"
              required
              :aria-invalid="Boolean(errors.college)"
              :aria-describedby="errors.college ? 'college-error' : undefined"
              placeholder="e.g. College of Natural Sciences and Mathematics"
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-msu-maroon focus:outline-none focus:ring-2 focus:ring-msu-maroon/20"
              @input="clearError('college')"
            />
            <p v-if="errors.college" id="college-error" class="mt-1 text-sm text-red-700">
              {{ errors.college }}
            </p>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label for="degree-program" class="mb-1 block text-sm font-medium text-slate-700">
                Degree program <span class="text-red-700">(required)</span>
              </label>
              <input
                id="degree-program"
                v-model="degreeProgram"
                type="text"
                maxlength="120"
                required
                :aria-invalid="Boolean(errors.degreeProgram)"
                :aria-describedby="errors.degreeProgram ? 'degree-program-error' : undefined"
                placeholder="e.g. BS Biology"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-msu-maroon focus:outline-none focus:ring-2 focus:ring-msu-maroon/20"
                @input="clearError('degreeProgram')"
              />
              <p v-if="errors.degreeProgram" id="degree-program-error" class="mt-1 text-sm text-red-700">
                {{ errors.degreeProgram }}
              </p>
            </div>

            <div>
              <label for="year-level" class="mb-1 block text-sm font-medium text-slate-700">
                Year level <span class="text-red-700">(required)</span>
              </label>
              <select
                id="year-level"
                v-model="yearLevel"
                required
                :aria-invalid="Boolean(errors.yearLevel)"
                :aria-describedby="errors.yearLevel ? 'year-level-error' : undefined"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-msu-maroon focus:outline-none focus:ring-2 focus:ring-msu-maroon/20"
                @change="clearError('yearLevel')"
              >
                <option value="">Select year level</option>
                <option value="1st year">1st year</option>
                <option value="2nd year">2nd year</option>
                <option value="3rd year">3rd year</option>
                <option value="4th year">4th year</option>
                <option value="5th year">5th year</option>
                <option value="6th year">6th year</option>
                <option value="Graduate">Graduate</option>
                <option value="Other">Other</option>
              </select>
              <p v-if="errors.yearLevel" id="year-level-error" class="mt-1 text-sm text-red-700">
                {{ errors.yearLevel }}
              </p>
            </div>
          </div>
        </section>

        <section class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <h2 class="text-base font-bold text-slate-900">Housing Preferences</h2>
            <p class="mt-1 text-xs text-slate-500">
              Choose a facility from the housing directory. Its type and location are shown below.
            </p>
          </div>

          <div>
            <label for="housing-property" class="mb-1 block text-sm font-medium text-slate-700">
              Preferred housing facility <span class="text-red-700">(required)</span>
            </label>
            <select
              id="housing-property"
              v-model="propertyId"
              required
              :disabled="housingStore.loading || housingStore.properties.length === 0"
              :aria-invalid="Boolean(errors.propertyId)"
              :aria-describedby="errors.propertyId ? 'housing-property-error' : undefined"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-msu-maroon focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 disabled:bg-slate-100"
              @change="clearError('propertyId')"
            >
              <option value="">
                {{ housingStore.loading ? 'Loading housing facilities...' : 'Select a facility' }}
              </option>
              <option v-for="property in housingStore.properties" :key="property.id" :value="property.id">
                {{ property.name }}
              </option>
            </select>
            <p v-if="errors.propertyId" id="housing-property-error" class="mt-1 text-sm text-red-700">
              {{ errors.propertyId }}
            </p>
            <p
              v-if="!housingStore.loading && housingStore.properties.length === 0"
              class="mt-2 text-sm text-slate-600"
            >
              No housing facilities are currently available. Visit the
              <router-link to="/housing" class="font-semibold text-msu-maroon underline">
                housing directory
              </router-link>
              and try again later.
            </p>
          </div>

          <div
            v-if="selectedProperty"
            class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
          >
            <p class="font-semibold text-slate-900">{{ selectedProperty.name }}</p>
            <p class="mt-1">
              {{ selectedProperty.type === 'institutional_dorm' ? 'Institutional dormitory' : 'Private boarding house' }}
              <span aria-hidden="true"> · </span>
              {{ selectedProperty.address }}
            </p>
            <p class="mt-1 text-xs text-slate-500">
              Monthly rate: ₱{{ selectedProperty.minMonthlyRate }}–₱{{ selectedProperty.maxMonthlyRate }}
            </p>
          </div>

          <div>
            <label for="application-remarks" class="mb-1 block text-sm font-medium text-slate-700">
              Additional details <span class="text-slate-500">(optional)</span>
            </label>
            <textarea
              id="application-remarks"
              v-model="remarks"
              rows="4"
              maxlength="1000"
              placeholder="Share any other information relevant to your housing application."
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-msu-maroon focus:outline-none focus:ring-2 focus:ring-msu-maroon/20"
            />
            <p class="mt-1 text-right text-xs text-slate-500">{{ remarks.length }}/1000</p>
          </div>
        </section>

        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            class="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-msu-maroon/30"
            @click="saveDraft"
          >
            Save Draft
          </button>
          <button
            type="submit"
            :disabled="isSubmitting || housingStore.loading"
            class="rounded-lg bg-msu-maroon px-4 py-2.5 text-sm font-semibold text-white hover:bg-msu-darkmaroon focus:outline-none focus:ring-2 focus:ring-msu-maroon/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ isSubmitting ? 'Submitting...' : 'Submit Application' }}
          </button>
        </div>
        <p class="text-xs text-slate-500">
          Saving a draft stores it only in this browser. It is not submitted until you choose
          <span class="font-semibold">Submit Application</span>.
        </p>
      </form>
    </div>
  </AppLayout>
</template>
