
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import { useHousingStore } from '../stores/housing';
import type { ApplicationStatus } from '../types';
import {
  Search,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  UserRound,
  MapPin,
  CalendarDays,
  MessageSquare,
  ShieldAlert,
} from 'lucide-vue-next';

interface ReviewApplication {
  id: string;
  studentName: string;
  studentEmail: string;
  propertyName: string;
  roomNumber: string;
  submittedAt: string;
  status: ApplicationStatus;
  purpose: string;
  notes: string;
}

const housingStore = useHousingStore();
const localStatuses = ref<Record<string, ApplicationStatus>>({});
const localNotes = ref<Record<string, string>>({});

const searchQuery = ref('');
const statusFilter = ref<'all' | ApplicationStatus>('all');
const selectedApplicationId = ref('');
const noteDraft = ref('');
const feedback = ref('');

const applications = computed<ReviewApplication[]>(() =>
  housingStore.applications.map(application => ({
    id: application.id,
    studentName: application.applicant.fullName,
    studentEmail: application.applicant.email,
    propertyName: application.property.name,
    roomNumber: application.unit?.roomNumber ?? 'Not assigned',
    submittedAt: new Date(application.createdAt).toLocaleDateString(),
    status: localStatuses.value[application.id] ?? application.status,
    purpose: application.remarks?.trim() || 'No purpose provided.',
    notes: localNotes.value[application.id] ?? '',
  })),
);

const selectedApplication = computed(() =>
  applications.value.find(app => app.id === selectedApplicationId.value)
    ?? applications.value[0]
    ?? null,
);

const filteredApplications = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return applications.value.filter(app => {
    const matchesStatus =
      statusFilter.value === 'all' || app.status === statusFilter.value;

    const matchesSearch =
      !query ||
      app.studentName.toLowerCase().includes(query) ||
      app.studentEmail.toLowerCase().includes(query) ||
      app.propertyName.toLowerCase().includes(query) ||
      app.id.toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });
});

const pendingCount = computed(
  () => applications.value.filter(app => app.status === 'pending').length,
);
const approvedCount = computed(
  () => applications.value.filter(app => app.status === 'approved').length,
);
const rejectedCount = computed(
  () => applications.value.filter(app => app.status === 'rejected').length,
);

function selectApplication(app: ReviewApplication) {
  selectedApplicationId.value = app.id;
  noteDraft.value = app.notes;
  feedback.value = '';
}

function updateStatus(status: ApplicationStatus) {
  if (!selectedApplication.value) return;

  const applicationId = selectedApplication.value.id;
  localStatuses.value = { ...localStatuses.value, [applicationId]: status };
  localNotes.value = { ...localNotes.value, [applicationId]: noteDraft.value.trim() };
  feedback.value =
    `Local-only action: ${applicationId} marked ${status}. This change is not saved to the server.`;
}

function saveLocalNote() {
  if (!selectedApplication.value) return;

  localNotes.value = {
    ...localNotes.value,
    [selectedApplication.value.id]: noteDraft.value.trim(),
  };
  feedback.value =
    'Note updated locally in this page only. It has not been saved to the server.';
}

function statusLabel(status: ApplicationStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusClass(status: ApplicationStatus) {
  if (status === 'pending') return 'bg-amber-100 text-amber-800';
  if (status === 'approved') return 'bg-emerald-100 text-emerald-800';
  if (status === 'rejected') return 'bg-red-100 text-red-800';
  return 'bg-slate-100 text-slate-700';
}

onMounted(() => {
  void housingStore.fetchApplicationsForReview();
});
</script>

<template>
  <AppLayout>
    <section class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p class="text-sm font-semibold text-msu-maroon">HOUSING MANAGEMENT</p>
        <h1 class="mt-1 text-2xl font-bold text-slate-900">
          Applications Review
        </h1>
        <p class="mt-2 text-sm text-slate-500">
          Review student housing requests and record your decision.
        </p>
      </div>

      <div class="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
        <ShieldAlert class="h-4 w-4 shrink-0" />
        Decisions and notes are local only
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-sm text-slate-500">Pending</p>
          <Clock class="h-5 w-5 text-amber-600" />
        </div>
        <p class="mt-3 text-3xl font-bold text-slate-900">{{ pendingCount }}</p>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-sm text-slate-500">Approved</p>
          <CheckCircle2 class="h-5 w-5 text-emerald-600" />
        </div>
        <p class="mt-3 text-3xl font-bold text-slate-900">{{ approvedCount }}</p>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-sm text-slate-500">Rejected</p>
          <XCircle class="h-5 w-5 text-red-600" />
        </div>
        <p class="mt-3 text-3xl font-bold text-slate-900">{{ rejectedCount }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 p-4">
          <h2 class="font-bold text-slate-900">Submitted Applications</h2>

          <div class="mt-4 flex flex-col gap-3 sm:flex-row">
            <div class="relative min-w-0 flex-1">
              <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                v-model="searchQuery"
                type="search"
                placeholder="Search applications..."
                class="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-msu-maroon focus:ring-2 focus:ring-red-100"
              />
            </div>

            <select
              v-model="statusFilter"
              class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-msu-maroon"
              aria-label="Filter by application status"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div
          v-if="housingStore.applicationsLoading && !applications.length"
          class="p-8 text-center text-sm text-slate-500"
          role="status"
        >
          Loading applications...
        </div>

        <div
          v-else-if="housingStore.applicationsError"
          class="p-6 text-center"
          role="alert"
        >
          <p class="text-sm text-red-700">{{ housingStore.applicationsError }}</p>
          <button
            type="button"
            :disabled="housingStore.applicationsLoading"
            @click="housingStore.fetchApplicationsForReview()"
            class="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ housingStore.applicationsLoading ? 'Retrying...' : 'Retry' }}
          </button>
        </div>

        <div v-else-if="filteredApplications.length" class="divide-y divide-slate-100">
          <button
            v-for="app in filteredApplications"
            :key="app.id"
            type="button"
            @click="selectApplication(app)"
            :class="[
              'w-full p-4 text-left transition-colors hover:bg-slate-50',
              selectedApplication?.id === app.id
                ? 'border-l-4 border-msu-maroon bg-red-50/40'
                : 'border-l-4 border-transparent',
            ]"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-semibold text-slate-900">
                  {{ app.studentName }}
                </p>
                <p class="mt-1 truncate text-xs text-slate-500">{{ app.id }}</p>
                <p class="mt-2 truncate text-sm text-slate-600">
                  {{ app.propertyName }}
                </p>
              </div>

              <span
                :class="[
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                  statusClass(app.status),
                ]"
              >
                {{ statusLabel(app.status) }}
              </span>
            </div>
            <p class="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <CalendarDays class="h-3.5 w-3.5" />
              Submitted {{ app.submittedAt }}
            </p>
          </button>
        </div>

        <div v-else class="p-8 text-center">
          <FileText class="mx-auto h-8 w-8 text-slate-300" />
          <p class="mt-3 font-medium text-slate-700">
            {{ applications.length ? 'No applications found' : 'No applications submitted yet' }}
          </p>
          <p class="mt-1 text-sm text-slate-500">
            {{ applications.length ? 'Try another search or status filter.' : 'Applications for your managed properties will appear here.' }}
          </p>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <template v-if="selectedApplication">
          <div class="border-b border-slate-200 p-5">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Application details
            </p>
            <div class="mt-2 flex flex-wrap items-center justify-between gap-3">
              <h2 class="text-lg font-bold text-slate-900">
                {{ selectedApplication.id }}
              </h2>
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {{ statusLabel(selectedApplication.status) }}
              </span>
            </div>
          </div>

          <div class="space-y-5 p-5">
            <div class="flex items-start gap-3">
              <UserRound class="mt-0.5 h-5 w-5 text-slate-400" />
              <div>
                <p class="font-semibold text-slate-900">{{ selectedApplication.studentName }}</p>
                <p class="mt-1 text-sm text-slate-500">{{ selectedApplication.studentEmail }}</p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <MapPin class="mt-0.5 h-5 w-5 text-slate-400" />
              <div>
                <p class="font-semibold text-slate-900">{{ selectedApplication.propertyName }}</p>
                <p class="mt-1 text-sm text-slate-500">{{ selectedApplication.roomNumber }}</p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <CalendarDays class="mt-0.5 h-5 w-5 text-slate-400" />
              <div>
                <p class="font-semibold text-slate-900">Submission date</p>
                <p class="mt-1 text-sm text-slate-500">{{ selectedApplication.submittedAt }}</p>
              </div>
            </div>

            <div>
              <h3 class="text-sm font-semibold text-slate-900">Student's purpose</h3>
              <p class="mt-2 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                {{ selectedApplication.purpose }}
              </p>
            </div>

            <div>
              <label for="review-notes" class="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <MessageSquare class="h-4 w-4" />
                Internal review notes
              </label>
              <textarea
                id="review-notes"
                v-model="noteDraft"
                rows="3"
                placeholder="Add notes for the review..."
                class="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-msu-maroon focus:ring-2 focus:ring-red-100"
              />
              <button
                type="button"
                @click="saveLocalNote"
                class="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Save note locally
              </button>
            </div>

            <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Application details are loaded from the API. Decisions and notes change only in this page's temporary local state.
            </div>

            <div v-if="selectedApplication.status === 'pending'" class="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                @click="updateStatus('approved')"
                class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <CheckCircle2 class="h-4 w-4" />
                Approve locally
              </button>
              <button
                type="button"
                @click="updateStatus('rejected')"
                class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                <XCircle class="h-4 w-4" />
                Reject locally
              </button>
            </div>

            <div v-if="feedback" role="status" class="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
              {{ feedback }}
            </div>
          </div>
        </template>

        <div v-else class="p-8 text-center text-sm text-slate-500">
          Select an application to review its details.
        </div>
      </div>
    </div>
    </section>
  </AppLayout>
</template>
