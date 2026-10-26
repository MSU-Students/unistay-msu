<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import AppLayout from '../components/layout/AppLayout.vue';
import { useHousingStore } from '../stores/housing';
import type { ApplicationStatus } from '../types';
import { Building2, CalendarDays, FileText, RefreshCw } from 'lucide-vue-next';

const housingStore = useHousingStore();

const statusStyles: Record<ApplicationStatus, { label: string; classes: string }> = {
  pending: { label: 'Pending', classes: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', classes: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Rejected', classes: 'bg-rose-100 text-rose-800' },
  cancelled: { label: 'Cancelled', classes: 'bg-slate-100 text-slate-700' },
};

function formatDate(value?: string): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

onMounted(() => {
  housingStore.fetchMyApplications();
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">My Housing Applications</h1>
          <p class="mt-1 text-sm text-slate-600">
            Review the status and latest details for your housing applications.
          </p>
        </div>
        <button
          type="button"
          :disabled="housingStore.applicationsLoading"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          @click="housingStore.fetchMyApplications()"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': housingStore.applicationsLoading }" />
          Refresh
        </button>
      </div>

      <div
        v-if="housingStore.applicationsLoading"
        class="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500"
        role="status"
      >
        Loading your applications...
      </div>

      <div
        v-else-if="housingStore.applicationsError"
        class="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center"
        role="alert"
      >
        <p class="font-semibold text-rose-800">Could not load your applications</p>
        <p class="mt-1 text-sm text-rose-700">{{ housingStore.applicationsError }}</p>
        <button
          type="button"
          class="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
          @click="housingStore.fetchMyApplications()"
        >
          Try again
        </button>
      </div>

      <div
        v-else-if="housingStore.applications.length === 0"
        class="rounded-xl border border-slate-200 bg-white p-8 text-center"
      >
        <FileText class="mx-auto h-10 w-10 text-slate-400" />
        <h2 class="mt-3 font-semibold text-slate-900">No applications yet</h2>
        <p class="mt-1 text-sm text-slate-600">Your housing applications will appear here.</p>
        <RouterLink
          to="/housing"
          class="mt-4 inline-flex rounded-lg bg-msu-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-msu-darkmaroon"
        >
          Browse housing
        </RouterLink>
      </div>

      <div v-else class="space-y-4">
        <article
          v-for="application in housingStore.applications"
          :key="application.id"
          class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <div class="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Building2 class="h-4 w-4 shrink-0 text-msu-maroon" />
                <h2 class="truncate">{{ application.property?.name || 'Housing property' }}</h2>
              </div>
              <p v-if="application.property?.address" class="mt-1 text-sm text-slate-600">
                {{ application.property.address }}
              </p>
              <p v-if="application.unit?.roomNumber" class="mt-1 text-sm text-slate-600">
                Unit / room: {{ application.unit.roomNumber }}
              </p>
            </div>
            <span
              class="inline-flex w-fit shrink-0 rounded-full px-3 py-1 text-xs font-bold"
              :class="statusStyles[application.status]?.classes || 'bg-slate-100 text-slate-700'"
            >
              {{ statusStyles[application.status]?.label || application.status }}
            </span>
          </div>

          <dl class="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
            <div class="min-w-0">
              <dt class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <FileText class="h-3.5 w-3.5" />
                Application ID
              </dt>
              <dd class="mt-1 break-all font-mono text-xs text-slate-800">{{ application.id }}</dd>
            </div>
            <div>
              <dt class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <CalendarDays class="h-3.5 w-3.5" />
                Submitted
              </dt>
              <dd class="mt-1 text-sm text-slate-800">{{ formatDate(application.createdAt) }}</dd>
            </div>
            <div>
              <dt class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <CalendarDays class="h-3.5 w-3.5" />
                Last updated
              </dt>
              <dd class="mt-1 text-sm text-slate-800">
                {{ formatDate(application.updatedAt || application.createdAt) }}
              </dd>
            </div>
          </dl>
        </article>
      </div>
    </div>
  </AppLayout>
</template>
