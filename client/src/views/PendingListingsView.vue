<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import { useHousingStore } from '../stores/housing';
import {
  Building2,
  CheckCircle2,
  Clock3,
  MapPin,
  Search,
  XCircle,
} from 'lucide-vue-next';

const housingStore = useHousingStore();
const searchQuery = ref('');
const rejectionListingId = ref<string | null>(null);
const rejectionReason = ref('');
const loading = ref(false);
const savingListingId = ref<string | null>(null);
const errorMessage = ref('');
const successMessage = ref('');

const filteredListings = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return housingStore.pendingProperties;

  return housingStore.pendingProperties.filter((property) =>
    [property.name, property.address, property.description]
      .some((value) => value.toLowerCase().includes(query)),
  );
});

onMounted(loadListings);

async function loadListings() {
  loading.value = true;
  errorMessage.value = '';
  try {
    await housingStore.fetchPendingProperties();
  } catch {
    errorMessage.value = 'Unable to load pending listings. Please try again.';
  } finally {
    loading.value = false;
  }
}

async function approveListing(id: string) {
  savingListingId.value = id;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    await housingStore.reviewProperty(id, 'approved');
    successMessage.value = 'Listing approved and published.';
  } catch {
    errorMessage.value = 'Unable to approve this listing. Please try again.';
  } finally {
    savingListingId.value = null;
  }
}

function openRejectionForm(id: string) {
  rejectionListingId.value = id;
  rejectionReason.value = '';
  errorMessage.value = '';
  successMessage.value = '';
}

async function rejectListing(id: string) {
  const reason = rejectionReason.value.trim();
  if (!reason) {
    errorMessage.value = 'Enter a reason before rejecting this listing.';
    return;
  }

  savingListingId.value = id;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    await housingStore.reviewProperty(id, 'rejected', reason);
    rejectionListingId.value = null;
    rejectionReason.value = '';
    successMessage.value = 'Listing rejected. The reason has been recorded.';
  } catch {
    errorMessage.value = 'Unable to reject this listing. Please try again.';
  } finally {
    savingListingId.value = null;
  }
}
</script>

<template>
  <AppLayout>
    <section class="space-y-6">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-semibold text-msu-maroon">HOUSING MANAGEMENT</p>
          <h1 class="mt-1 text-2xl font-bold text-slate-900">Pending Listings</h1>
          <p class="mt-2 text-sm text-slate-500">
            Review housing listings submitted for accreditation.
          </p>
        </div>
        <div class="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          <Clock3 class="h-4 w-4" />
          {{ housingStore.pendingProperties.length }} awaiting review
        </div>
      </header>

      <div class="relative">
        <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Search listings by name, address, or description..."
          aria-label="Search pending listings"
          class="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-msu-maroon focus:ring-2 focus:ring-red-100"
        />
      </div>

      <p v-if="errorMessage" role="alert" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {{ errorMessage }}
      </p>
      <p v-if="successMessage" role="status" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        {{ successMessage }}
      </p>

      <div v-if="loading" class="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
        Loading pending listings...
      </div>

      <div v-else-if="filteredListings.length" class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <article
          v-for="property in filteredListings"
          :key="property.id"
          class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div class="flex items-start gap-4 border-b border-slate-100 p-5">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50 text-msu-maroon">
              <Building2 class="h-5 w-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold uppercase tracking-wide text-msu-maroon">
                {{ property.type === 'institutional_dorm' ? 'Institutional Dorm' : 'Private Boarding House' }}
              </p>
              <h2 class="mt-1 text-lg font-bold text-slate-900">{{ property.name }}</h2>
              <p class="mt-1 flex items-start gap-1.5 text-sm text-slate-500">
                <MapPin class="mt-0.5 h-4 w-4 shrink-0" />
                {{ property.address }}
              </p>
            </div>
            <span class="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              Pending
            </span>
          </div>

          <div class="space-y-4 p-5">
            <p class="text-sm leading-6 text-slate-600">{{ property.description }}</p>
            <div class="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
              <div>
                <p class="text-xs text-slate-500">Monthly rate</p>
                <p class="mt-1 font-semibold text-slate-900">
                  ₱{{ property.minMonthlyRate }} – ₱{{ property.maxMonthlyRate }}
                </p>
              </div>
              <div v-if="property.proximityToCollege">
                <p class="text-xs text-slate-500">Near</p>
                <p class="mt-1 font-semibold text-slate-900">{{ property.proximityToCollege }}</p>
              </div>
              <div v-if="property.amenities?.length" class="col-span-2">
                <p class="text-xs text-slate-500">Amenities</p>
                <p class="mt-1 font-medium text-slate-800">{{ property.amenities.join(', ') }}</p>
              </div>
            </div>

            <div v-if="rejectionListingId === property.id" class="space-y-2">
              <label :for="`rejection-reason-${property.id}`" class="block text-sm font-semibold text-slate-800">
                Reason for rejection
              </label>
              <textarea
                :id="`rejection-reason-${property.id}`"
                v-model="rejectionReason"
                rows="3"
                required
                placeholder="Explain what needs to be corrected..."
                class="w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-msu-maroon focus:ring-2 focus:ring-red-100"
              />
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  @click="rejectionListingId = null; errorMessage = ''"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  :disabled="savingListingId === property.id"
                  class="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  @click="rejectListing(property.id)"
                >
                  Confirm rejection
                </button>
              </div>
            </div>

            <div v-else class="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
              <button
                type="button"
                :disabled="savingListingId === property.id"
                class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                @click="approveListing(property.id)"
              >
                <CheckCircle2 class="h-4 w-4" />
                Approve & publish
              </button>
              <button
                type="button"
                :disabled="savingListingId === property.id"
                class="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                @click="openRejectionForm(property.id)"
              >
                <XCircle class="h-4 w-4" />
                Reject
              </button>
            </div>
          </div>
        </article>
      </div>

      <div v-else-if="!errorMessage" class="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <CheckCircle2 class="mx-auto h-9 w-9 text-emerald-500" />
        <h2 class="mt-3 font-semibold text-slate-900">
          {{ searchQuery ? 'No matching listings' : 'All caught up' }}
        </h2>
        <p class="mt-1 text-sm text-slate-500">
          {{ searchQuery ? 'Try a different search term.' : 'There are no pending listings to review.' }}
        </p>
      </div>
      <div v-else class="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <button
          type="button"
          class="rounded-lg bg-msu-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-msu-darkmaroon"
          @click="loadListings"
        >
          Retry loading listings
        </button>
      </div>
    </section>
  </AppLayout>
</template>
