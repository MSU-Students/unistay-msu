<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import { useHousingStore } from '../stores/housing';
import type {
  ApplicationStatus,
  HousingApplicationReportFilters,
  HousingApplicationReportItem,
} from '../types';
import { AlertTriangle, Building2, CalendarDays, Flag, RefreshCw, ShieldAlert } from 'lucide-vue-next';

const housingStore = useHousingStore();
const filters = reactive<HousingApplicationReportFilters>({});
const complianceError = ref<string | null>(null);
const savingApplicationId = ref<string | null>(null);
const editingApplicationId = ref<string | null>(null);
const complianceDraft = reactive({
  policyException: false,
  policyExceptionReason: '',
  escalated: false,
  escalationReason: '',
});

const statusOptions: ApplicationStatus[] = ['pending', 'approved', 'rejected', 'cancelled'];
const applications = computed(() => housingStore.adminApplicationReport?.applications || []);
const summary = computed(() => housingStore.adminApplicationReport?.summary);

function currentFilters(): HousingApplicationReportFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined),
  ) as HousingApplicationReportFilters;
}

function loadReport() {
  return housingStore.fetchAdminApplicationReport(currentFilters());
}

function clearFilters() {
  filters.propertyId = undefined;
  filters.status = undefined;
  filters.fromDate = undefined;
  filters.toDate = undefined;
  loadReport();
}

function formatDate(value?: string): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function statusLabel(status: ApplicationStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusClasses(status: ApplicationStatus): string {
  const styles: Record<ApplicationStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-rose-100 text-rose-800',
    cancelled: 'bg-slate-100 text-slate-700',
  };
  return styles[status];
}

function editCompliance(application: HousingApplicationReportItem) {
  editingApplicationId.value = application.id;
  complianceError.value = null;
  complianceDraft.policyException = application.policyException;
  complianceDraft.policyExceptionReason = application.policyExceptionReason || '';
  complianceDraft.escalated = application.escalated;
  complianceDraft.escalationReason = application.escalationReason || '';
}

async function saveCompliance(application: HousingApplicationReportItem) {
  complianceError.value = null;
  savingApplicationId.value = application.id;
  try {
    await housingStore.updateApplicationCompliance(
      application.id,
      {
        policyException: complianceDraft.policyException,
        policyExceptionReason: complianceDraft.policyExceptionReason,
        escalated: complianceDraft.escalated,
        escalationReason: complianceDraft.escalationReason,
      },
      currentFilters(),
    );
    editingApplicationId.value = null;
  } catch (error) {
    complianceError.value =
      error instanceof Error ? error.message : 'Unable to save compliance flags.';
  } finally {
    savingApplicationId.value = null;
  }
}

onMounted(() => {
  void Promise.all([
    housingStore.fetchProperties(),
    loadReport(),
  ]);
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Housing Application Reports</h1>
          <p class="mt-1 text-sm text-slate-600">
            Monitor application volumes, decisions, workflow history, and flagged compliance cases.
          </p>
        </div>
        <button
          type="button"
          :disabled="housingStore.adminReportLoading"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          @click="loadReport"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': housingStore.adminReportLoading }" />
          Refresh report
        </button>
      </header>

      <form
        class="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
        @submit.prevent="loadReport"
      >
        <label class="text-xs font-medium text-slate-600">
          Property
          <select
            v-model="filters.propertyId"
            class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            <option :value="undefined">All properties</option>
            <option v-for="property in housingStore.properties" :key="property.id" :value="property.id">
              {{ property.name }}
            </option>
          </select>
        </label>
        <label class="text-xs font-medium text-slate-600">
          Status
          <select
            v-model="filters.status"
            class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            <option :value="undefined">All statuses</option>
            <option v-for="status in statusOptions" :key="status" :value="status">
              {{ statusLabel(status) }}
            </option>
          </select>
        </label>
        <label class="text-xs font-medium text-slate-600">
          Submitted from
          <input
            v-model="filters.fromDate"
            type="date"
            class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
          />
        </label>
        <label class="text-xs font-medium text-slate-600">
          Submitted to
          <input
            v-model="filters.toDate"
            type="date"
            class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
          />
        </label>
        <div class="flex items-end gap-2">
          <button
            type="submit"
            class="flex-1 rounded-lg bg-msu-maroon px-3 py-2 text-sm font-semibold text-white hover:bg-msu-darkmaroon"
          >
            Apply filters
          </button>
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            @click="clearFilters"
          >
            Clear
          </button>
        </div>
      </form>

      <p v-if="housingStore.adminReportError" class="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
        {{ housingStore.adminReportError }}
      </p>

      <div v-if="housingStore.adminReportLoading" class="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500" role="status">
        Loading application report...
      </div>

      <template v-else-if="summary">
        <section class="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7" aria-label="Application totals">
          <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Total</p>
            <p class="mt-1 text-2xl font-bold text-slate-900">{{ summary.total }}</p>
          </div>
          <div class="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p class="text-xs font-medium uppercase tracking-wide text-amber-800">Pending</p>
            <p class="mt-1 text-2xl font-bold text-amber-900">{{ summary.pending }}</p>
          </div>
          <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p class="text-xs font-medium uppercase tracking-wide text-emerald-800">Approved</p>
            <p class="mt-1 text-2xl font-bold text-emerald-900">{{ summary.approved }}</p>
          </div>
          <div class="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p class="text-xs font-medium uppercase tracking-wide text-rose-800">Rejected</p>
            <p class="mt-1 text-2xl font-bold text-rose-900">{{ summary.rejected }}</p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-medium uppercase tracking-wide text-slate-600">Cancelled</p>
            <p class="mt-1 text-2xl font-bold text-slate-800">{{ summary.cancelled }}</p>
          </div>
          <div class="rounded-xl border border-orange-200 bg-orange-50 p-4">
            <p class="text-xs font-medium uppercase tracking-wide text-orange-800">Policy exceptions</p>
            <p class="mt-1 text-2xl font-bold text-orange-900">{{ summary.policyExceptions }}</p>
          </div>
          <div class="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <p class="text-xs font-medium uppercase tracking-wide text-purple-800">Escalated</p>
            <p class="mt-1 text-2xl font-bold text-purple-900">{{ summary.escalated }}</p>
          </div>
        </section>

        <section v-if="applications.length" class="space-y-4">
          <article
            v-for="application in applications"
            :key="application.id"
            class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 class="flex items-center gap-2 font-semibold text-slate-900">
                  <Building2 class="h-4 w-4 text-msu-maroon" />
                  {{ application.property.name }}
                </h2>
                <p class="mt-1 text-sm text-slate-600">
                  {{ application.applicant.fullName }}
                  <span v-if="application.applicant.studentIdNumber"> · {{ application.applicant.studentIdNumber }}</span>
                </p>
                <p class="text-sm text-slate-500">
                  {{ application.property.address }}
                  <span v-if="application.unit?.roomNumber"> · Room {{ application.unit.roomNumber }}</span>
                </p>
              </div>
              <span class="w-fit rounded-full px-3 py-1 text-xs font-bold" :class="statusClasses(application.status)">
                {{ statusLabel(application.status) }}
              </span>
            </div>

            <div class="mt-4 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
              <div>
                <h3 class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                  <CalendarDays class="h-4 w-4" />
                  Workflow history
                </h3>
                <ol v-if="application.statusHistory?.length" class="mt-2 space-y-2 border-l-2 border-slate-200 pl-4">
                  <li v-for="(entry, index) in application.statusHistory" :key="`${entry.changedAt}-${index}`" class="text-sm">
                    <span class="font-medium text-slate-800">{{ statusLabel(entry.status) }}</span>
                    <span class="ml-2 text-slate-500">{{ formatDate(entry.changedAt) }}</span>
                    <span class="block text-xs text-slate-500">
                      {{ entry.changedBy === application.applicant.id ? 'Submitted by student' : `Changed by account (${entry.changedBy})` }}
                    </span>
                  </li>
                </ol>
                <p v-else class="mt-2 text-sm text-slate-500">
                  No status history was recorded for this application.
                </p>
                <p class="mt-2 text-xs text-slate-500">
                  Created {{ formatDate(application.createdAt) }} · Updated {{ formatDate(application.updatedAt) }}
                </p>
              </div>

              <div>
                <h3 class="text-xs font-bold uppercase tracking-wide text-slate-600">Policy and escalation flags</h3>
                <div class="mt-2 flex flex-wrap gap-2">
                  <span
                    v-if="application.policyException"
                    class="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800"
                  >
                    <Flag class="h-3.5 w-3.5" /> Policy exception
                  </span>
                  <span
                    v-if="application.escalated"
                    class="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-800"
                  >
                    <ShieldAlert class="h-3.5 w-3.5" /> Escalated
                  </span>
                  <span v-if="!application.policyException && !application.escalated" class="text-sm text-slate-500">
                    No policy exceptions or escalations flagged.
                  </span>
                </div>
                <p v-if="application.policyExceptionReason" class="mt-2 text-sm text-orange-900">
                  Exception: {{ application.policyExceptionReason }}
                </p>
                <p v-if="application.escalationReason" class="mt-1 text-sm text-purple-900">
                  Escalation: {{ application.escalationReason }}
                </p>
                <button
                  type="button"
                  class="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  @click="editCompliance(application)"
                >
                  {{ editingApplicationId === application.id ? 'Editing flags' : 'Manage flags' }}
                </button>
              </div>
            </div>

            <form
              v-if="editingApplicationId === application.id"
              class="mt-4 space-y-3 rounded-lg bg-slate-50 p-4"
              @submit.prevent="saveCompliance(application)"
            >
              <div class="grid gap-3 md:grid-cols-2">
                <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input v-model="complianceDraft.policyException" type="checkbox" />
                  Flag policy exception
                </label>
                <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input v-model="complianceDraft.escalated" type="checkbox" />
                  Escalate application
                </label>
                <label class="text-xs font-medium text-slate-600">
                  Exception reason
                  <input
                    v-model="complianceDraft.policyExceptionReason"
                    :required="complianceDraft.policyException"
                    class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Required when exception is flagged"
                  />
                </label>
                <label class="text-xs font-medium text-slate-600">
                  Escalation reason
                  <input
                    v-model="complianceDraft.escalationReason"
                    :required="complianceDraft.escalated"
                    class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Required when application is escalated"
                  />
                </label>
              </div>
              <p v-if="complianceError" class="text-sm text-rose-700" role="alert">{{ complianceError }}</p>
              <div class="flex gap-2">
                <button
                  type="submit"
                  :disabled="savingApplicationId === application.id"
                  class="rounded-lg bg-msu-maroon px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {{ savingApplicationId === application.id ? 'Saving...' : 'Save flags' }}
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                  @click="editingApplicationId = null; complianceError = null"
                >
                  Cancel
                </button>
              </div>
            </form>
          </article>
        </section>

        <div v-else class="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <AlertTriangle class="mx-auto h-8 w-8 text-slate-400" />
          <p class="mt-2 font-semibold text-slate-800">No applications match these filters.</p>
        </div>
      </template>
    </div>
  </AppLayout>
</template>
