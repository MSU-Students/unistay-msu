
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import { useHousingStore } from '../stores/housing';
import { useAuthStore } from '../stores/auth';
import type {
  ApplicationStatus,
  HousingApplicationReportFilters,
  HousingApplicationReportItem,
} from '../types';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Filter,
  Flag,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-vue-next';

const housingStore = useHousingStore();
const authStore = useAuthStore();

const filters = reactive<HousingApplicationReportFilters & { searchQuery?: string }>({
  propertyId: undefined,
  status: undefined,
  fromDate: undefined,
  toDate: undefined,
  searchQuery: '',
});

const complianceError = ref<string | null>(null);
const savingApplicationId = ref<string | null>(null);
const editingApplicationId = ref<string | null>(null);
const actionInProgressId = ref<string | null>(null);

const complianceDraft = reactive({
  policyException: false,
  policyExceptionReason: '',
  escalated: false,
  escalationReason: '',
});

const statusOptions: ApplicationStatus[] = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
];

const rawApplications = computed(
  () => housingStore.adminApplicationReport?.applications || [],
);
const summary = computed(() => housingStore.adminApplicationReport?.summary);

const filteredApplications = computed(() => {
  let list = rawApplications.value;

  if (filters.searchQuery?.trim()) {
    const q = filters.searchQuery.toLowerCase().trim();

    list = list.filter(
      (app) =>
        app.applicant.fullName.toLowerCase().includes(q) ||
        (app.applicant.studentIdNumber &&
          app.applicant.studentIdNumber.toLowerCase().includes(q)) ||
        app.property.name.toLowerCase().includes(q) ||
        (app.unit?.roomNumber &&
          app.unit.roomNumber.toLowerCase().includes(q)) ||
        (app.applicant.college &&
          app.applicant.college.toLowerCase().includes(q)),
    );
  }

  return list;
});

function currentApiFilters(): HousingApplicationReportFilters {
  const result: HousingApplicationReportFilters = {};

  if (filters.propertyId) result.propertyId = filters.propertyId;
  if (filters.status) result.status = filters.status;
  if (filters.fromDate) result.fromDate = filters.fromDate;
  if (filters.toDate) result.toDate = filters.toDate;

  return result;
}

function loadReport() {
  return housingStore.fetchAdminApplicationReport(currentApiFilters());
}

function setStatusFilter(status?: ApplicationStatus) {
  filters.status = filters.status === status ? undefined : status;
  void loadReport();
}

function clearFilters() {
  filters.propertyId = undefined;
  filters.status = undefined;
  filters.fromDate = undefined;
  filters.toDate = undefined;
  filters.searchQuery = '';
  void loadReport();
}

function formatDate(value?: string): string {
  if (!value) return 'Not available';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

function statusLabel(status: ApplicationStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusClasses(status: ApplicationStatus): string {
  const styles: Record<ApplicationStatus, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    rejected: 'bg-rose-100 text-rose-800 border-rose-200',
    cancelled: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return styles[status] || 'bg-slate-100 text-slate-700 border-slate-200';
}

function editCompliance(application: HousingApplicationReportItem) {
  // Compliance editing is restricted to University Admins.
  if (!authStore.isAdmin) return;

  if (editingApplicationId.value === application.id) {
    editingApplicationId.value = null;
    return;
  }

  editingApplicationId.value = application.id;
  complianceError.value = null;
  complianceDraft.policyException = application.policyException;
  complianceDraft.policyExceptionReason =
    application.policyExceptionReason || '';
  complianceDraft.escalated = application.escalated;
  complianceDraft.escalationReason = application.escalationReason || '';
}

async function saveCompliance(application: HousingApplicationReportItem) {
  if (!authStore.isAdmin) {
    complianceError.value = 'Only University Admins can edit compliance flags.';
    return;
  }

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
      currentApiFilters(),
    );

    editingApplicationId.value = null;
  } catch (error) {
    complianceError.value =
      error instanceof Error
        ? error.message
        : 'Unable to save compliance flags.';
  } finally {
    savingApplicationId.value = null;
  }
}

async function handleStatusChange(
  application: HousingApplicationReportItem,
  newStatus: ApplicationStatus,
) {
  actionInProgressId.value = application.id;

  try {
    await housingStore.updateApplicationStatus(
      application.id,
      newStatus,
      currentApiFilters(),
    );
  } catch (error) {
    // Do not silently treat a failed update as successful.
    console.error('Unable to update application status:', error);
  } finally {
    actionInProgressId.value = null;
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
    <!-- Access Control Barrier for Unauthorized Roles -->
    <div
      v-if="!authStore.isAdmin && !authStore.isManager"
      class="max-w-2xl mx-auto py-12 px-4 text-center"
    >
      <div class="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 space-y-5">
        <div class="w-16 h-16 bg-rose-100 text-rose-700 rounded-2xl mx-auto flex items-center justify-center">
          <ShieldAlert class="w-8 h-8" />
        </div>

        <div class="space-y-2">
          <h2 class="text-2xl font-bold text-slate-900">
            Administrative Access Required
          </h2>
          <p class="text-sm text-slate-600">
            This module contains housing application summaries and sensitive
            student tenancy information. Access is restricted to University
            Administrators and authorized Property Managers.
          </p>
        </div>

        <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-2">
          <div class="font-semibold text-slate-800">Current Session State:</div>
          <div class="text-slate-600">
            Role:
            <span class="font-mono font-bold text-slate-900">
              {{ authStore.user?.role || 'Guest / Unauthenticated' }}
            </span>
          </div>
          <div class="text-slate-600">
            Required:
            <span class="font-mono font-bold text-emerald-700">
              university_admin or property_manager
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Authorized Admin and Property Manager View -->
    <div v-else class="space-y-6">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-msu-maroon mb-1">
            <ShieldCheck class="w-4 h-4 text-emerald-600" />
            <span>Team 2 · Administrative Housing Reports</span>
          </div>

          <h1 class="text-2xl sm:text-3xl font-black text-slate-900">
            Housing Application Reports & Traceability
          </h1>

          <p class="mt-1 text-sm text-slate-600 max-w-3xl">
            Application volume monitoring, workflow progression tracking,
            policy exceptions, and administrative decisions.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            :disabled="housingStore.adminReportLoading"
            class="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 transition-all"
            @click="loadReport"
          >
            <RefreshCw
              class="h-4 w-4 text-slate-500"
              :class="{ 'animate-spin': housingStore.adminReportLoading }"
            />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      <!-- Summary Metrics -->
      <section v-if="summary" aria-label="Application Summary Metrics">
        <div class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
          <span>Summary Metrics (Click a card to filter)</span>
          <button
            v-if="filters.status"
            type="button"
            class="text-msu-maroon font-semibold cursor-pointer hover:underline"
            @click="setStatusFilter(undefined)"
          >
            Reset status filter
          </button>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <button
            type="button"
            @click="setStatusFilter(undefined)"
            class="text-left rounded-xl border p-4 shadow-sm transition-all bg-white hover:border-slate-400"
            :class="filters.status === undefined ? 'ring-2 ring-slate-800 border-slate-800 bg-slate-50' : 'border-slate-200'"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wide text-slate-500">Total</span>
              <Building2 class="w-4 h-4 text-slate-400" />
            </div>
            <p class="mt-2 text-3xl font-black text-slate-900">{{ summary.total }}</p>
            <span class="text-[11px] text-slate-500 font-medium">All applications</span>
          </button>

          <button
            type="button"
            @click="setStatusFilter('pending')"
            class="text-left rounded-xl border p-4 shadow-sm transition-all hover:border-amber-400 bg-white"
            :class="filters.status === 'pending' ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/60' : 'border-amber-200'"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wide text-amber-800">Pending</span>
              <Clock class="w-4 h-4 text-amber-600" />
            </div>
            <p class="mt-2 text-3xl font-black text-amber-900">{{ summary.pending }}</p>
            <span class="text-[11px] text-amber-700 font-medium">Awaiting decision</span>
          </button>

          <button
            type="button"
            @click="setStatusFilter('approved')"
            class="text-left rounded-xl border p-4 shadow-sm transition-all hover:border-emerald-400 bg-white"
            :class="filters.status === 'approved' ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/60' : 'border-emerald-200'"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wide text-emerald-800">Approved</span>
              <CheckCircle2 class="w-4 h-4 text-emerald-600" />
            </div>
            <p class="mt-2 text-3xl font-black text-emerald-900">{{ summary.approved }}</p>
            <span class="text-[11px] text-emerald-700 font-medium">Approved applications</span>
          </button>

          <button
            type="button"
            @click="setStatusFilter('rejected')"
            class="text-left rounded-xl border p-4 shadow-sm transition-all hover:border-rose-400 bg-white"
            :class="filters.status === 'rejected' ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-50/60' : 'border-rose-200'"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wide text-rose-800">Rejected</span>
              <XCircle class="w-4 h-4 text-rose-600" />
            </div>
            <p class="mt-2 text-3xl font-black text-rose-900">{{ summary.rejected }}</p>
            <span class="text-[11px] text-rose-700 font-medium">Declined submissions</span>
          </button>

          <button
            type="button"
            @click="setStatusFilter('cancelled')"
            class="text-left rounded-xl border p-4 shadow-sm transition-all hover:border-slate-400 bg-white"
            :class="filters.status === 'cancelled' ? 'ring-2 ring-slate-500 border-slate-500 bg-slate-100' : 'border-slate-200'"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wide text-slate-600">Cancelled</span>
              <XCircle class="w-4 h-4 text-slate-400" />
            </div>
            <p class="mt-2 text-3xl font-black text-slate-800">{{ summary.cancelled }}</p>
            <span class="text-[11px] text-slate-500 font-medium">Withdrawn applications</span>
          </button>

          <div class="rounded-xl border border-orange-200 bg-orange-50/70 p-4 shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wide text-orange-800">Exceptions</span>
              <Flag class="w-4 h-4 text-orange-600" />
            </div>
            <p class="mt-2 text-3xl font-black text-orange-900">{{ summary.policyExceptions }}</p>
            <span class="text-[11px] text-orange-700 font-medium">Policy exception cases</span>
          </div>

          <div class="rounded-xl border border-purple-200 bg-purple-50/70 p-4 shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wide text-purple-800">Escalated</span>
              <ShieldAlert class="w-4 h-4 text-purple-600" />
            </div>
            <p class="mt-2 text-3xl font-black text-purple-900">{{ summary.escalated }}</p>
            <span class="text-[11px] text-purple-700 font-medium">Flagged for review</span>
          </div>
        </div>
      </section>

      <!-- Filters -->
      <section
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
        aria-label="Filters"
      >
        <div class="flex items-center justify-between">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <Filter class="w-4 h-4 text-msu-maroon" />
            <span>Filtering Options</span>
          </h2>

          <button
            type="button"
            class="text-xs font-semibold text-slate-500 hover:text-msu-maroon transition-colors"
            @click="clearFilters"
          >
            Clear all filters
          </button>
        </div>

        <form
          class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
          @submit.prevent="loadReport"
        >
          <div>
            <label class="text-xs font-semibold text-slate-700">Search Applicant / Room</label>
            <div class="relative mt-1">
              <Search class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                v-model="filters.searchQuery"
                type="text"
                placeholder="Student name, ID, or room..."
                class="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
              />
            </div>
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-700">Property / Dormitory</label>
            <select
              v-model="filters.propertyId"
              @change="loadReport"
              class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
            >
              <option :value="undefined">All properties</option>
              <option
                v-for="property in housingStore.properties"
                :key="property.id"
                :value="property.id"
              >
                {{ property.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-700">Application Status</label>
            <select
              v-model="filters.status"
              @change="loadReport"
              class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
            >
              <option :value="undefined">All statuses</option>
              <option v-for="status in statusOptions" :key="status" :value="status">
                {{ statusLabel(status) }}
              </option>
            </select>
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-700">Submitted From</label>
            <input
              v-model="filters.fromDate"
              @change="loadReport"
              type="date"
              class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
            />
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-700">Submitted To</label>
            <input
              v-model="filters.toDate"
              @change="loadReport"
              type="date"
              class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
            />
          </div>
        </form>
      </section>

      <!-- Loading / Error States -->
      <p
        v-if="housingStore.adminReportError"
        class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        role="alert"
      >
        {{ housingStore.adminReportError }}
      </p>

      <div
        v-if="housingStore.adminReportLoading"
        class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500 shadow-sm"
        role="status"
      >
        <RefreshCw class="w-6 h-6 animate-spin text-msu-maroon mx-auto mb-2" />
        <span>Loading application report...</span>
      </div>

      <!-- Applications List -->
      <section v-else-if="filteredApplications.length" class="space-y-4">
        <div class="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing <strong>{{ filteredApplications.length }}</strong> application records
          </span>
          <span class="hidden sm:inline">
            Workflow Traceability & Compliance Controls
          </span>
        </div>

        <article
          v-for="application in filteredApplications"
          :key="application.id"
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  {{ application.id }}
                </span>
                <span
                  class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold border"
                  :class="statusClasses(application.status)"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
                  {{ statusLabel(application.status) }}
                </span>
              </div>

              <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 class="h-5 w-5 text-msu-maroon flex-shrink-0" />
                <span>{{ application.property.name }}</span>
                <span
                  v-if="application.unit?.roomNumber"
                  class="text-sm font-semibold text-slate-500"
                >
                  · Room {{ application.unit.roomNumber }}
                </span>
              </h3>

              <p class="text-sm text-slate-700 font-medium flex items-center gap-2">
                <User class="w-4 h-4 text-slate-400" />
                <span>{{ application.applicant.fullName }}</span>
                <span
                  v-if="application.applicant.studentIdNumber"
                  class="text-slate-500 font-mono text-xs"
                >
                  ({{ application.applicant.studentIdNumber }})
                </span>
                <span
                  v-if="application.applicant.college"
                  class="bg-amber-100 text-amber-900 text-[11px] font-semibold px-2 py-0.5 rounded"
                >
                  {{ application.applicant.college }}
                </span>
              </p>

              <p class="text-xs text-slate-500">
                {{ application.property.address }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2 sm:self-start">
              <button
                v-if="application.status !== 'approved'"
                type="button"
                :disabled="actionInProgressId === application.id"
                @click="handleStatusChange(application, 'approved')"
                class="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                <CheckCircle2 class="w-3.5 h-3.5" />
                <span>Approve</span>
              </button>

              <button
                v-if="application.status !== 'rejected'"
                type="button"
                :disabled="actionInProgressId === application.id"
                @click="handleStatusChange(application, 'rejected')"
                class="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                <XCircle class="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>

              <button
                v-if="authStore.isAdmin"
                type="button"
                @click="editCompliance(application)"
                class="inline-flex items-center gap-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              >
                <Flag class="w-3.5 h-3.5 text-orange-600" />
                <span>
                  {{ editingApplicationId === application.id ? 'Close Flags' : 'Manage Flags' }}
                </span>
              </button>
            </div>
          </div>

          <!-- Workflow Traceability -->
          <div class="mt-5 border-t border-slate-100 pt-4 space-y-3">
            <div class="text-xs font-bold uppercase tracking-wide text-slate-600 flex items-center gap-2">
              <CalendarDays class="h-4 w-4 text-msu-maroon" />
              <span>Workflow Traceability (Submission to Decision)</span>
            </div>

            <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div class="flex items-start gap-3">
                  <div class="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    ✓
                  </div>
                  <div class="text-xs">
                    <p class="font-bold text-slate-800">1. Submitted</p>
                    <p class="text-slate-500">{{ formatDate(application.createdAt) }}</p>
                    <p class="text-[11px] text-slate-400">
                      By {{ application.applicant.fullName }}
                    </p>
                  </div>
                </div>

                <div class="flex items-start gap-3">
                  <div
                    class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
                    :class="application.status === 'pending' ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-emerald-100 text-emerald-700'"
                  >
                    {{ application.status === 'pending' ? '⏳' : '✓' }}
                  </div>
                  <div class="text-xs">
                    <p class="font-bold text-slate-800">2. Review & Governance</p>
                    <p class="text-slate-500">
                      {{ application.status === 'pending' ? 'Active Review' : 'Reviewed' }}
                    </p>
                    <p class="text-[11px] text-slate-400">
                      Institutional quota & rules
                    </p>
                  </div>
                </div>

                <div class="flex items-start gap-3">
                  <div
                    class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
                    :class="{
                      'bg-emerald-100 text-emerald-700': application.status === 'approved',
                      'bg-rose-100 text-rose-700': application.status === 'rejected',
                      'bg-slate-200 text-slate-600': application.status === 'cancelled',
                      'bg-slate-100 text-slate-400': application.status === 'pending',
                    }"
                  >
                    {{ application.status === 'approved' ? '✓' : application.status === 'rejected' ? '✕' : application.status === 'cancelled' ? '—' : '3' }}
                  </div>
                  <div class="text-xs">
                    <p class="font-bold text-slate-800">3. Decision Outcome</p>
                    <p class="font-semibold" :class="statusClasses(application.status)">
                      {{ statusLabel(application.status) }}
                    </p>
                    <p class="text-[11px] text-slate-400">
                      Updated {{ formatDate(application.updatedAt) }}
                    </p>
                  </div>
                </div>
              </div>

              <div
                v-if="application.statusHistory?.length"
                class="mt-4 pt-3 border-t border-slate-200 text-xs"
              >
                <span class="font-semibold text-slate-600 block mb-1">
                  Audit Log History:
                </span>
                <div class="space-y-1">
                  <div
                    v-for="(entry, index) in application.statusHistory"
                    :key="`${entry.changedAt}-${index}`"
                    class="flex items-center gap-2 text-[11px] text-slate-600"
                  >
                    <span class="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span class="font-semibold uppercase text-slate-800">
                      {{ entry.status }}
                    </span>
                    <span>at {{ formatDate(entry.changedAt) }}</span>
                    <span class="text-slate-400">
                      ({{ entry.changedBy === application.applicant.id ? 'Student' : 'Staff' }})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Compliance & Exceptions -->
          <div class="mt-4 pt-3 border-t border-slate-100 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wide text-slate-600">
                Compliance & Exceptions
              </span>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <span
                v-if="application.policyException"
                class="inline-flex items-center gap-1.5 rounded-full bg-orange-100 border border-orange-200 px-3 py-1 text-xs font-bold text-orange-800"
              >
                <Flag class="h-3.5 w-3.5 text-orange-600" />
                <span>Policy Exception: {{ application.policyExceptionReason }}</span>
              </span>

              <span
                v-if="application.escalated"
                class="inline-flex items-center gap-1.5 rounded-full bg-purple-100 border border-purple-200 px-3 py-1 text-xs font-bold text-purple-800"
              >
                <ShieldAlert class="h-3.5 w-3.5 text-purple-600" />
                <span>Escalated: {{ application.escalationReason }}</span>
              </span>

              <span
                v-if="!application.policyException && !application.escalated"
                class="text-xs text-slate-500 italic"
              >
                Standard application — No active policy exceptions or escalations.
              </span>
            </div>

            <!-- Only University Admins can edit compliance flags -->
            <form
              v-if="authStore.isAdmin && editingApplicationId === application.id"
              class="mt-3 space-y-3 rounded-xl bg-slate-50 border border-slate-200 p-4"
              @submit.prevent="saveCompliance(application)"
            >
              <div class="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Update Compliance & Exceptions for #{{ application.id }}
              </div>

              <div class="grid gap-3 md:grid-cols-2">
                <label class="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <input
                    v-model="complianceDraft.policyException"
                    type="checkbox"
                    class="rounded text-msu-maroon focus:ring-msu-maroon"
                  />
                  Flag Policy Exception
                </label>

                <label class="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <input
                    v-model="complianceDraft.escalated"
                    type="checkbox"
                    class="rounded text-purple-700 focus:ring-purple-700"
                  />
                  Escalate Application
                </label>

                <div>
                  <label class="text-xs font-medium text-slate-600">
                    Policy Exception Reason
                  </label>
                  <input
                    v-model="complianceDraft.policyExceptionReason"
                    :required="complianceDraft.policyException"
                    class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
                    placeholder="Reason for policy exception"
                  />
                </div>

                <div>
                  <label class="text-xs font-medium text-slate-600">
                    Escalation Reason
                  </label>
                  <input
                    v-model="complianceDraft.escalationReason"
                    :required="complianceDraft.escalated"
                    class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                    placeholder="Reason for escalation"
                  />
                </div>
              </div>

              <p
                v-if="complianceError"
                class="text-xs text-rose-700 font-semibold"
                role="alert"
              >
                {{ complianceError }}
              </p>

              <div class="flex gap-2 pt-2">
                <button
                  type="submit"
                  :disabled="savingApplicationId === application.id"
                  class="rounded-lg bg-msu-maroon px-4 py-2 text-xs font-semibold text-white shadow hover:bg-msu-darkmaroon disabled:opacity-60 transition-colors"
                >
                  {{ savingApplicationId === application.id ? 'Saving Changes...' : 'Save Compliance Flags' }}
                </button>

                <button
                  type="button"
                  class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  @click="editingApplicationId = null; complianceError = null"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </article>
      </section>

      <!-- Empty Filter State -->
      <div
        v-else-if="!housingStore.adminReportLoading"
        class="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm"
      >
        <AlertTriangle class="mx-auto h-10 w-10 text-amber-500 mb-3" />
        <h3 class="text-base font-bold text-slate-800">
          No applications match your current filters
        </h3>
        <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Try another property, clear the search query, or reset the date range.
        </p>
        <button
          type="button"
          @click="clearFilters"
          class="mt-4 inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Reset All Filters
        </button>
      </div>
    </div>
  </AppLayout>
</template>