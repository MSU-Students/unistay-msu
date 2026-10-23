
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import { useHousingStore } from '../stores/housing';
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

type ReviewStatus = 'pending' | 'approved' | 'rejected';

interface ReviewApplication {
  id: string;
  studentName: string;
  studentEmail: string;
  propertyName: string;
  roomNumber: string;
  submittedAt: string;
  status: ReviewStatus;
  purpose: string;
  notes: string;
}

interface ApiApplication {
  id: string;
  applicant?: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  property?: {
    name?: string;
  };
  unit?: {
    roomNumber?: string;
    roomName?: string;
  };
  status: string;
  createdAt?: string;
  remarks?: string | null;
  purpose?: string;
}

const housingStore = useHousingStore();
const applications = ref<ReviewApplication[]>([]);
const searchQuery = ref('');
const statusFilter = ref<'all' | ReviewStatus>('all');
const selectedApplicationId = ref('');
const noteDraft = ref('');
const feedback = ref('');
const isLoading = ref(false);
const isSavingStatus = ref(false);
const loadError = ref('');

function mapApplication(item: ApiApplication): ReviewApplication {
  const applicantName =
    item.applicant?.fullName ||
    [item.applicant?.firstName, item.applicant?.lastName].filter(Boolean).join(' ') ||
    'Student name unavailable';

  return {
    id: item.id,
    studentName: applicantName,
    studentEmail: item.applicant?.email || 'Email unavailable',
    propertyName: item.property?.name || 'Property unavailable',
    roomNumber: item.unit?.roomNumber || item.unit?.roomName || 'No unit assigned',
    submittedAt: item.createdAt
      ? new Date(item.createdAt).toLocaleDateString()
      : 'Date unavailable',
    status: item.status === 'approved' || item.status === 'rejected'
      ? item.status
      : 'pending',
    purpose: item.purpose || item.remarks || 'No purpose or remarks provided.',
    notes: '',
  };
}

const selectedApplication = computed(() =>
  applications.value.find(app => app.id === selectedApplicationId.value) ?? null,
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

watch(selectedApplication, app => {
  noteDraft.value = app?.notes ?? '';
});


async function loadApplications() {
  isLoading.value = true;
  loadError.value = '';
  feedback.value = '';

  try {
    await housingStore.fetchManagerApplications();

    const responseApplications =
      housingStore.applications as unknown as ApiApplication[];

    applications.value = Array.isArray(responseApplications)
      ? responseApplications.map(mapApplication)
      : [];

    if (
      !selectedApplicationId.value ||
      !applications.value.some(
        app => app.id === selectedApplicationId.value,
      )
    ) {
      selectedApplicationId.value = applications.value[0]?.id ?? '';
    }
  } catch (error) {
    console.error('Failed to load manager applications:', error);

    loadError.value =
      'Unable to load applications. The request failed. Please check the API, your login, and your permissions.';
  } finally {
    isLoading.value = false;
  }
}


function selectApplication(app: ReviewApplication) {
  selectedApplicationId.value = app.id;
  noteDraft.value = app.notes;
  feedback.value = '';
}

async function updateStatus(status: 'approved' | 'rejected') {
  if (!selectedApplication.value || isSavingStatus.value) return;

  const applicationId = selectedApplication.value.id;
  isSavingStatus.value = true;
  feedback.value = '';

  try {
    await housingStore.updateApplicationStatus(applicationId, status);
    await loadApplications();

    selectedApplicationId.value = applicationId;
    feedback.value = `Application ${applicationId} was ${status}.`;
  } catch (error) {
    console.error('Failed to update application status:', error);
    feedback.value =
      'Could not update the application. Please check your connection and permissions, then try again.';
  } finally {
    isSavingStatus.value = false;
  }
}

function statusLabel(status: ReviewStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

onMounted(loadApplications);
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

      <div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
        <ShieldAlert class="h-4 w-4 shrink-0" />
        Live application records
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
            </select>
          </div>
        </div>

        <div v-if="isLoading" class="p-8 text-center text-sm text-slate-500">
          Loading applications...
        </div>

        <div v-else-if="loadError" class="p-6">
          <p role="alert" class="text-sm text-red-700">{{ loadError }}</p>
          <button
            type="button"
            @click="loadApplications"
            class="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Try again
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
              selectedApplicationId === app.id
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
                  app.status === 'pending'
                    ? 'bg-amber-100 text-amber-800'
                    : app.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800',
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
          <p class="mt-3 font-medium text-slate-700">No applications found</p>
          <p class="mt-1 text-sm text-slate-500">Try another search or status filter.</p>
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
                placeholder="Internal review notes are not connected to the API yet."
                disabled
                class="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-500 outline-none"
              />
            </div>

            <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
              Application details and decisions are loaded from the API. Internal review notes are not persisted because a notes-update API endpoint is not currently connected.
            </div>

            <div v-if="selectedApplication.status === 'pending'" class="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                @click="updateStatus('approved')"
                :disabled="isSavingStatus"
                class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 class="h-4 w-4" />
                {{ isSavingStatus ? 'Saving...' : 'Approve application' }}
              </button>
              <button
                type="button"
                @click="updateStatus('rejected')"
                :disabled="isSavingStatus"
                class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle class="h-4 w-4" />
                {{ isSavingStatus ? 'Saving...' : 'Reject application' }}
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
