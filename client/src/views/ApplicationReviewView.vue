<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppLayout from '../components/layout/AppLayout.vue';
import { useApplicationReviewStore } from '../stores/applicationReview';
import type { ApplicationStatus, SupportingDocument } from '../types';
import {
  ArrowLeft,
  Building2,
  Check,
  ClipboardList,
  FileText,
  Search,
  UserRound,
  X,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const reviewStore = useApplicationReviewStore();

const searchQuery = ref('');
const statusFilter = ref<ApplicationStatus | ''>('');
const actionMessage = ref<string | null>(null);
const actionError = ref<string | null>(null);
const processingAction = ref<string | null>(null);
const confirmation = ref<'approved' | 'rejected' | null>(null);
const showInformationDialog = ref(false);
const informationMessage = ref('');
const internalNotes = ref('');
const notesFeedback = ref<string | null>(null);
const notesError = ref<string | null>(null);

const selectedId = computed(() => (typeof route.params.id === 'string' ? route.params.id : null));
const filteredApplications = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return reviewStore.applications.filter((application) => {
    const matchesStatus = !statusFilter.value || application.status === statusFilter.value;
    const matchesQuery =
      !query ||
      application.applicant.fullName.toLowerCase().includes(query) ||
      application.property.name.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });
});

watch(
  () => [selectedId.value, reviewStore.selectedApplication?.id] as const,
  ([id]) => {
    reviewStore.selectApplication(id);
    internalNotes.value = reviewStore.selectedApplication?.internalReviewNotes ?? '';
    notesFeedback.value = null;
    notesError.value = null;
    actionMessage.value = null;
    actionError.value = null;
  },
);

onMounted(async () => {
  try {
    await reviewStore.loadApplications();
    reviewStore.selectApplication(selectedId.value);
    internalNotes.value = reviewStore.selectedApplication?.internalReviewNotes ?? '';
  } catch {
    // The store exposes the load error in the page's retry state.
  }
});

function statusLabel(status: ApplicationStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusClasses(status: ApplicationStatus) {
  switch (status) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    case 'cancelled':
      return 'bg-slate-100 text-slate-700';
    case 'pending':
      return 'bg-amber-100 text-amber-800';
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString();
}

function documentHref(document: SupportingDocument) {
  if (document.url) return document.url;
  if (document.mockContent) {
    return `data:text/plain;charset=utf-8,${encodeURIComponent(document.mockContent)}`;
  }
  return undefined;
}

async function confirmStatusChange() {
  const application = reviewStore.selectedApplication;
  const nextStatus = confirmation.value;
  if (!application || !nextStatus || processingAction.value) return;

  processingAction.value = nextStatus;
  actionError.value = null;
  actionMessage.value = null;
  try {
    await reviewStore.changeStatus(application.id, nextStatus);
    actionMessage.value = `Application ${nextStatus}. This demo action is not saved to the server.`;
    confirmation.value = null;
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : 'Unable to update this application.';
  } finally {
    processingAction.value = null;
  }
}

async function submitInformationRequest() {
  const application = reviewStore.selectedApplication;
  const message = informationMessage.value.trim();
  if (!application || processingAction.value) return;
  if (message.length < 5 || message.length > 500) {
    actionError.value = 'Enter a request between 5 and 500 characters.';
    return;
  }

  processingAction.value = 'information';
  actionError.value = null;
  actionMessage.value = null;
  try {
    await reviewStore.requestInformation(application.id, message);
    actionMessage.value = 'Information request recorded in this demo. The application remains pending.';
    informationMessage.value = '';
    showInformationDialog.value = false;
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : 'Unable to record the information request.';
  } finally {
    processingAction.value = null;
  }
}

async function saveNotes() {
  const application = reviewStore.selectedApplication;
  const notes = internalNotes.value.trim();
  notesError.value = null;
  notesFeedback.value = null;

  if (!application || processingAction.value) return;
  if (notes.length < 3 || notes.length > 1000) {
    notesError.value = 'Internal notes must be between 3 and 1,000 characters.';
    return;
  }

  processingAction.value = 'notes';
  try {
    await reviewStore.saveNotes(application.id, notes);
    notesFeedback.value = 'Internal note saved in this demo only; it is not visible to students.';
  } catch (cause) {
    notesError.value = cause instanceof Error ? cause.message : 'Unable to save internal notes.';
  } finally {
    processingAction.value = null;
  }
}

async function retryLoadingApplications() {
  try {
    await reviewStore.loadApplications();
  } catch {
    // The failed load remains visible through the store's error state.
  }
}

function openApplication(id: string) {
  router.push({ name: 'application-review', params: { id } });
}

function returnToApplications() {
  router.push({ name: 'application-review' });
}
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-msu-maroon">
            <ClipboardList class="w-4 h-4" />
            Manager workspace
          </div>
          <h1 class="mt-1 text-2xl font-bold text-slate-900">Application Reviews</h1>
          <p class="mt-1 text-sm text-slate-600">
            Review student applications for your managed properties.
          </p>
        </div>
        <div class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Demo data only — changes are temporary and are not saved to the server.
        </div>
      </header>

      <div
        v-if="actionMessage"
        class="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        role="status"
      >
        <span>{{ actionMessage }}</span>
        <button class="font-semibold underline" @click="actionMessage = null">Dismiss</button>
      </div>
      <div
        v-if="actionError"
        class="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        role="alert"
      >
        <span>{{ actionError }}</span>
        <button class="font-semibold underline" @click="actionError = null">Dismiss</button>
      </div>

      <div v-if="reviewStore.loading" class="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Loading applications…
      </div>

      <div v-else-if="reviewStore.error" class="rounded-xl border border-red-200 bg-white p-8 text-center">
        <p class="font-semibold text-red-800">Applications could not be loaded.</p>
        <p class="mt-1 text-sm text-slate-600">{{ reviewStore.error }}</p>
        <button
          class="mt-4 rounded-lg bg-msu-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-msu-darkmaroon"
          @click="retryLoadingApplications"
        >
          Try again
        </button>
      </div>

      <template v-else-if="selectedId">
        <div v-if="reviewStore.selectedApplication" class="space-y-5">
          <button
            class="inline-flex items-center gap-2 text-sm font-semibold text-msu-maroon hover:underline"
            @click="returnToApplications"
          >
            <ArrowLeft class="h-4 w-4" />
            Back to applications
          </button>

          <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <section class="space-y-5 xl:col-span-2">
              <article class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Application {{ reviewStore.selectedApplication.id }}
                    </p>
                    <h2 class="mt-1 text-xl font-bold text-slate-900">
                      {{ reviewStore.selectedApplication.applicant.fullName }}
                    </h2>
                  </div>
                  <span
                    :class="statusClasses(reviewStore.selectedApplication.status)"
                    class="rounded-full px-3 py-1 text-xs font-bold uppercase"
                  >
                    {{ statusLabel(reviewStore.selectedApplication.status) }}
                  </span>
                </div>

                <div class="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                  <div>
                    <div class="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <UserRound class="h-4 w-4" /> Applicant
                    </div>
                    <p class="mt-1 font-semibold text-slate-900">
                      {{ reviewStore.selectedApplication.applicant.fullName }}
                    </p>
                    <p class="text-sm text-slate-600">{{ reviewStore.selectedApplication.applicant.email }}</p>
                  </div>
                  <div>
                    <div class="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <Building2 class="h-4 w-4" /> Property
                    </div>
                    <p class="mt-1 font-semibold text-slate-900">
                      {{ reviewStore.selectedApplication.property.name }}
                    </p>
                    <p class="text-sm text-slate-600">{{ reviewStore.selectedApplication.property.address }}</p>
                    <p v-if="reviewStore.selectedApplication.unit" class="text-sm text-slate-600">
                      Unit {{ reviewStore.selectedApplication.unit.roomNumber }}
                    </p>
                  </div>
                  <div>
                    <p class="text-xs font-medium text-slate-500">Application date</p>
                    <p class="mt-1 text-sm font-semibold text-slate-900">
                      {{ formatDate(reviewStore.selectedApplication.createdAt) }}
                    </p>
                  </div>
                  <div>
                    <p class="text-xs font-medium text-slate-500">Monthly rate</p>
                    <p class="mt-1 text-sm font-semibold text-slate-900">
                      ₱{{ reviewStore.selectedApplication.property.minMonthlyRate }}–₱{{ reviewStore.selectedApplication.property.maxMonthlyRate }}
                    </p>
                  </div>
                </div>

                <div v-if="reviewStore.selectedApplication.remarks" class="mt-5 rounded-lg bg-slate-50 p-4">
                  <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Applicant remarks</h3>
                  <p class="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {{ reviewStore.selectedApplication.remarks }}
                  </p>
                </div>
              </article>

              <article class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div class="flex items-center gap-2">
                  <FileText class="h-5 w-5 text-msu-maroon" />
                  <h2 class="font-bold text-slate-900">Supporting documents</h2>
                </div>
                <div v-if="reviewStore.selectedApplication.supportingDocuments.length" class="mt-4 divide-y divide-slate-100">
                  <div
                    v-for="document in reviewStore.selectedApplication.supportingDocuments"
                    :key="document.id"
                    class="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p class="text-sm font-semibold text-slate-800">{{ document.name }}</p>
                      <p class="text-xs text-slate-500">{{ document.description }}</p>
                    </div>
                    <a
                      v-if="documentHref(document)"
                      :href="documentHref(document)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex w-fit items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <FileText class="h-3.5 w-3.5" />
                      {{ document.url ? 'Open document' : 'Open demo preview' }}
                    </a>
                    <span v-else class="text-xs text-slate-400">No preview available</span>
                  </div>
                </div>
                <p v-else class="mt-3 text-sm text-slate-500">No supporting documents were provided.</p>
              </article>
            </section>

            <aside class="space-y-5">
              <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 class="font-bold text-slate-900">Review decision</h2>
                <p class="mt-1 text-xs text-slate-500">Actions are available while the application is pending.</p>
                <div class="mt-4 grid gap-2">
                  <button
                    :disabled="reviewStore.selectedApplication.status !== 'pending' || !!processingAction"
                    class="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    @click="confirmation = 'approved'"
                  >
                    <Check class="h-4 w-4" /> Approve
                  </button>
                  <button
                    :disabled="reviewStore.selectedApplication.status !== 'pending' || !!processingAction"
                    class="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    @click="confirmation = 'rejected'"
                  >
                    <X class="h-4 w-4" /> Reject
                  </button>
                  <button
                    :disabled="reviewStore.selectedApplication.status !== 'pending' || !!processingAction"
                    class="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    @click="actionError = null; showInformationDialog = true"
                  >
                    Request More Information
                  </button>
                </div>
              </section>

              <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 class="font-bold text-slate-900">Internal review notes</h2>
                <p class="mt-1 text-xs text-slate-500">
                  Private to the manager in this demo. Notes are not shared with the applicant.
                </p>
                <textarea
                  v-model="internalNotes"
                  rows="5"
                  maxlength="1000"
                  placeholder="Add a private note for this review…"
                  class="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-msu-maroon focus:outline-none focus:ring-2 focus:ring-msu-maroon/20"
                />
                <p class="mt-1 text-right text-xs text-slate-400">{{ internalNotes.length }}/1000</p>
                <p v-if="notesError" class="mt-2 text-xs text-red-700" role="alert">{{ notesError }}</p>
                <p v-if="notesFeedback" class="mt-2 text-xs text-emerald-700" role="status">{{ notesFeedback }}</p>
                <button
                  :disabled="!!processingAction"
                  class="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  @click="saveNotes"
                >
                  {{ processingAction === 'notes' ? 'Saving…' : 'Save internal note' }}
                </button>
              </section>

              <p v-if="reviewStore.selectedApplication.informationRequest" class="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                Demo information request: {{ reviewStore.selectedApplication.informationRequest }}
              </p>
            </aside>
          </div>
        </div>
        <div v-else class="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p class="font-semibold text-slate-900">Application not found</p>
          <p class="mt-1 text-sm text-slate-500">This application is not available in the demo review data.</p>
          <button class="mt-4 text-sm font-semibold text-msu-maroon hover:underline" @click="returnToApplications">
            Return to applications
          </button>
        </div>
      </template>

      <template v-else>
        <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex flex-col gap-3 sm:flex-row">
            <label class="relative flex-1">
              <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                v-model="searchQuery"
                type="search"
                placeholder="Search applicant or property"
                class="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-msu-maroon focus:outline-none focus:ring-2 focus:ring-msu-maroon/20"
              />
            </label>
            <select
              v-model="statusFilter"
              aria-label="Filter applications by status"
              class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-msu-maroon focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </section>

        <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div v-if="filteredApplications.length" class="overflow-x-auto">
            <table class="w-full min-w-[700px] text-left">
              <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-5 py-3 font-semibold">Applicant</th>
                  <th class="px-5 py-3 font-semibold">Property</th>
                  <th class="px-5 py-3 font-semibold">Applied</th>
                  <th class="px-5 py-3 font-semibold">Status</th>
                  <th class="px-5 py-3"><span class="sr-only">Review</span></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="application in filteredApplications"
                  :key="application.id"
                  class="hover:bg-slate-50"
                >
                  <td class="px-5 py-4">
                    <p class="text-sm font-semibold text-slate-900">{{ application.applicant.fullName }}</p>
                    <p class="text-xs text-slate-500">{{ application.applicant.email }}</p>
                  </td>
                  <td class="px-5 py-4 text-sm text-slate-700">{{ application.property.name }}</td>
                  <td class="px-5 py-4 text-sm text-slate-600">{{ formatDate(application.createdAt) }}</td>
                  <td class="px-5 py-4">
                    <span
                      :class="statusClasses(application.status)"
                      class="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase"
                    >
                      {{ statusLabel(application.status) }}
                    </span>
                  </td>
                  <td class="px-5 py-4 text-right">
                    <button
                      class="rounded-lg px-3 py-1.5 text-xs font-semibold text-msu-maroon hover:bg-red-50"
                      @click="openApplication(application.id)"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="px-6 py-12 text-center">
            <ClipboardList class="mx-auto h-9 w-9 text-slate-300" />
            <p class="mt-3 font-semibold text-slate-700">No applications found</p>
            <p class="mt-1 text-sm text-slate-500">
              {{ reviewStore.applications.length ? 'Try changing your search or status filter.' : 'There are no applications to review yet.' }}
            </p>
          </div>
        </section>
      </template>

      <div
        v-if="confirmation"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        role="presentation"
        @click.self="confirmation = null"
      >
        <section
          class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="'status-confirm-title'"
        >
          <h2 id="status-confirm-title" class="text-lg font-bold text-slate-900">
            {{ confirmation === 'approved' ? 'Approve application?' : 'Reject application?' }}
          </h2>
          <p class="mt-2 text-sm text-slate-600">
            Confirm that you want to {{ confirmation }} this application. This demo update is temporary.
          </p>
          <div class="mt-5 flex justify-end gap-2">
            <button
              :disabled="!!processingAction"
              class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              @click="confirmation = null"
            >
              Cancel
            </button>
            <button
              :disabled="!!processingAction"
              class="rounded-lg bg-msu-maroon px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              @click="confirmStatusChange"
            >
              {{ processingAction ? 'Processing…' : `Confirm ${confirmation}` }}
            </button>
          </div>
        </section>
      </div>

      <div
        v-if="showInformationDialog"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        role="presentation"
        @click.self="showInformationDialog = false"
      >
        <section class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="information-title">
          <h2 id="information-title" class="text-lg font-bold text-slate-900">Request more information</h2>
          <p class="mt-2 text-sm text-slate-600">
            Add the information needed from the applicant. The application will remain pending.
          </p>
          <textarea
            v-model="informationMessage"
            rows="4"
            maxlength="500"
            placeholder="Describe the additional information or document needed…"
            class="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-msu-maroon focus:outline-none focus:ring-2 focus:ring-msu-maroon/20"
          />
          <p class="mt-1 text-right text-xs text-slate-400">{{ informationMessage.length }}/500</p>
          <div class="mt-5 flex justify-end gap-2">
            <button
              :disabled="!!processingAction"
              class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              @click="showInformationDialog = false"
            >
              Cancel
            </button>
            <button
              :disabled="!!processingAction"
              class="rounded-lg bg-msu-maroon px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              @click="submitInformationRequest"
            >
              {{ processingAction === 'information' ? 'Sending…' : 'Submit request' }}
            </button>
          </div>
        </section>
      </div>
    </div>
  </AppLayout>
</template>
