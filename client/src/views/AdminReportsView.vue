<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppLayout from '../components/layout/AppLayout.vue';
import apiClient from '../api/client';
import { useAuthStore } from '../stores/auth';
import { AlertTriangle, BarChart3, Building2, Briefcase, ClipboardList, Receipt, Wrench } from 'lucide-vue-next';

type ReportView =
  | 'overview'
  | 'applications'
  | 'billing'
  | 'maintenance'
  | 'gigs'
  | 'properties'
  | 'attention';

interface ReportRow {
  id?: string;
  type?: string;
  severity?: string;
  title?: string;
  detail?: string;
  status?: string;
  createdAt?: string | null;
  dueDate?: string;
  pendingDays?: number | null;
  totalAmount?: number;
  paidAmount?: number;
  priority?: string;
  applicant?: { fullName?: string };
  tenant?: { fullName?: string };
  postedBy?: { fullName?: string };
  property?: { name?: string };
  name?: string;
  capacity?: number;
  occupied?: number;
  occupancyPercent?: number;
  compensationAmount?: number;
  [key: string]: unknown;
}

interface ReportPayload {
  total?: number;
  page?: number;
  pageSize?: number;
  items?: ReportRow[];
  overdueAccounts?: ReportRow[];
  counts?: Record<string, number>;
  totals?: Record<string, number>;
  priorityCounts?: Record<string, number>;
  averageResolutionHours?: number;
  staleCount?: number;
  openCount?: number;
  activeCount?: number;
  completedCount?: number;
  stalledCount?: number;
  applications?: Record<string, unknown>;
  billing?: Record<string, unknown>;
  maintenance?: Record<string, unknown>;
  gigs?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  attentionCount?: number;
  [key: string]: unknown;
}

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const activeView = computed<ReportView>(() => {
  const view = route.query.view;
  const validViews: ReportView[] = [
    'overview',
    'applications',
    'billing',
    'maintenance',
    'gigs',
    'properties',
    'attention',
  ];
  return typeof view === 'string' && validViews.includes(view as ReportView)
    ? (view as ReportView)
    : 'overview';
});

const tabs: { key: ReportView; label: string; icon: typeof BarChart3 }[] = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'applications', label: 'Applications', icon: ClipboardList },
  { key: 'billing', label: 'Billing', icon: Receipt },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench },
  { key: 'gigs', label: 'Gigs', icon: Briefcase },
  { key: 'properties', label: 'Properties', icon: Building2 },
  { key: 'attention', label: 'Needs Attention', icon: AlertTriangle },
];

const statusOptions: Partial<Record<ReportView, string[]>> = {
  applications: ['pending', 'approved', 'rejected', 'cancelled'],
  billing: ['unpaid', 'partially_paid', 'paid', 'overdue'],
  maintenance: ['open', 'in_progress', 'resolved', 'closed'],
  gigs: ['open', 'assigned', 'completed', 'cancelled'],
};
const sortOptions: Partial<Record<ReportView, string[]>> = {
  applications: ['createdAt', 'updatedAt', 'status'],
  billing: ['createdAt', 'updatedAt', 'dueDate', 'status'],
  maintenance: ['createdAt', 'updatedAt', 'status', 'title'],
  gigs: ['createdAt', 'updatedAt', 'status', 'title'],
};

const filter = ref({
  propertyId: '',
  dateFrom: '',
  dateTo: '',
  status: '',
  page: 1,
  pageSize: 20,
  sortBy: 'createdAt',
  sortOrder: 'DESC',
});
const properties = ref<{ id: string; name: string }[]>([]);
const report = ref<ReportPayload | null>(null);
const overview = ref<ReportPayload | null>(null);
const attention = ref<ReportPayload | null>(null);
const loading = ref(false);
const errorMessage = ref('');
let requestSequence = 0;

const reportItems = computed(() => report.value?.items || []);
const summaryCards = computed(() => {
  const value = overview.value;
  if (!value) return [];
  const applications = value.applications || {};
  const billing = value.billing || {};
  const maintenance = value.maintenance || {};
  const gigs = value.gigs || {};
  const total = (record: Record<string, unknown>, key: string) =>
    typeof record[key] === 'number' ? record[key] as number : 0;
  return [
    { label: 'Applications', value: total(applications, 'total'), detail: `${total(applications, 'pending')} pending` },
    { label: 'Outstanding billing', value: formatCurrency(total(billing, 'outstanding')), detail: `${total(billing, 'overdueCount')} overdue invoices` },
    { label: 'Open maintenance', value: total(maintenance, 'open'), detail: `${total(maintenance, 'staleCount')} stale tickets` },
    { label: 'Active gigs', value: total(gigs, 'active'), detail: `${total(gigs, 'stalledCount')} stalled` },
  ];
});
const reportStats = computed(() => {
  if (!report.value) return [];
  const stats: { label: string; value: string }[] = [];
  for (const [status, count] of Object.entries(report.value.counts || {})) {
    stats.push({ label: status.replace('_', ' '), value: String(count) });
  }
  for (const [key, amount] of Object.entries(report.value.totals || {})) {
    const isCurrency = ['billed', 'collected', 'outstanding', 'overdue'].includes(key);
    stats.push({
      label: key.replace(/([A-Z])/g, ' $1'),
      value: isCurrency ? formatCurrency(amount) : String(amount),
    });
  }
  for (const [priority, count] of Object.entries(report.value.priorityCounts || {})) {
    stats.push({ label: `${priority} priority`, value: String(count) });
  }
  if (typeof report.value.openCount === 'number') {
    stats.push({ label: 'Open tickets', value: String(report.value.openCount) });
  }
  if (typeof report.value.staleCount === 'number') {
    stats.push({ label: 'Stale items', value: String(report.value.staleCount) });
  }
  if (typeof report.value.averageResolutionHours === 'number') {
    stats.push({
      label: 'Average resolution',
      value: `${report.value.averageResolutionHours} hours`,
    });
  }
  if (typeof report.value.activeCount === 'number') {
    stats.push({ label: 'Active gigs', value: String(report.value.activeCount) });
  }
  if (typeof report.value.completedCount === 'number') {
    stats.push({ label: 'Completed gigs', value: String(report.value.completedCount) });
  }
  if (typeof report.value.stalledCount === 'number') {
    stats.push({ label: 'Stalled gigs', value: String(report.value.stalledCount) });
  }
  return stats;
});

const columns = computed(() => {
  const map: Record<ReportView, string[]> = {
    overview: [],
    applications: ['applicant', 'property', 'status', 'createdAt', 'pendingDays'],
    billing: ['invoiceNumber', 'tenant', 'property', 'status', 'totalAmount', 'paidAmount', 'dueDate'],
    maintenance: ['title', 'property', 'priority', 'status', 'createdAt', 'resolvedAt'],
    gigs: ['title', 'postedBy', 'status', 'compensationAmount', 'createdAt', 'updatedAt'],
    properties: ['name', 'type', 'units', 'capacity', 'occupied', 'occupancyPercent', 'applications', 'billing', 'maintenance', 'gigs'],
    attention: ['severity', 'title', 'detail', 'createdAt'],
  };
  return map[activeView.value];
});

const isAdmin = computed(() => authStore.isAdmin);

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCell(row: ReportRow, column: string): string {
  if (column === 'applicant' || column === 'tenant' || column === 'postedBy') {
    const user = row[column] as { fullName?: string } | undefined;
    return user?.fullName || '—';
  }
  if (column === 'property') {
    const property = row.property as { name?: string } | undefined;
    return property?.name || '—';
  }
  if (column === 'applications') {
    const statuses = row.applications as Record<string, number> | undefined;
    const count = Object.values(statuses || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    return `${count} total · ${Number(statuses?.pending || 0)} pending`;
  }
  if (column === 'billing') {
    const billing = row.billing as Record<string, number> | undefined;
    return `${formatCurrency(Number(billing?.outstanding || 0))} outstanding`;
  }
  if (column === 'maintenance') {
    const counts = row.maintenance as Record<string, number> | undefined;
    const open = Number(counts?.open || 0) + Number(counts?.in_progress || 0);
    return `${open} open`;
  }
  if (column === 'gigs') {
    return 'Not attributable';
  }
  if (column === 'totalAmount' || column === 'paidAmount' || column === 'compensationAmount') {
    return formatCurrency(Number(row[column] || 0));
  }
  if (column === 'occupancyPercent') {
    return `${Number(row[column] || 0).toFixed(1)}%`;
  }
  if (column === 'createdAt' || column === 'updatedAt' || column === 'dueDate' || column === 'resolvedAt') {
    const date = row[column];
    return date ? new Date(String(date)).toLocaleDateString() : '—';
  }
  if (column === 'pendingDays') {
    return row.pendingDays === null || row.pendingDays === undefined
      ? '—'
      : `${row.pendingDays} days`;
  }
  const value = row[column];
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '—';
}

function heading(column: string): string {
  return column.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}

async function updateFilters() {
  await router.replace({
    query: {
      ...route.query,
      propertyId: filter.value.propertyId || undefined,
      dateFrom: filter.value.dateFrom || undefined,
      dateTo: filter.value.dateTo || undefined,
      status: filter.value.status || undefined,
      page: filter.value.page > 1 ? String(filter.value.page) : undefined,
      sortBy: filter.value.sortBy !== 'createdAt' ? filter.value.sortBy : undefined,
      sortOrder: filter.value.sortOrder !== 'DESC' ? filter.value.sortOrder : undefined,
    },
  });
}

async function selectView(view: ReportView) {
  filter.value.page = 1;
  filter.value.status = '';
  filter.value.sortBy = 'createdAt';
  filter.value.sortOrder = 'DESC';
  await router.replace({
    query: {
      ...route.query,
      view,
      page: undefined,
      status: undefined,
      sortBy: undefined,
      sortOrder: undefined,
    },
  });
}

async function loadReport() {
  if (!isAdmin.value) return;
  const requestId = ++requestSequence;
  const query = { ...route.query };
  const params = {
    propertyId: query.propertyId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    status: query.status,
    page: query.page,
    pageSize: filter.value.pageSize,
    sortBy: query.sortBy || filter.value.sortBy,
    sortOrder: query.sortOrder || filter.value.sortOrder,
  };
  loading.value = true;
  errorMessage.value = '';
  try {
    const [overviewResponse, propertyResponse, attentionResponse] = await Promise.all([
      apiClient.get('/admin/reports/overview', { params }),
      apiClient.get('/housing/properties'),
      apiClient.get('/admin/reports/attention', { params }),
    ]);
    if (requestId !== requestSequence) return;
    overview.value = overviewResponse.data.data;
    properties.value = (propertyResponse.data.data || []).map(
      (property: { id: string; name: string }) => ({
        id: property.id,
        name: property.name,
      }),
    );
    attention.value = attentionResponse.data.data;

    if (activeView.value === 'overview') {
      report.value = overview.value;
    } else if (activeView.value === 'attention') {
      report.value = attention.value;
    } else {
      const response = await apiClient.get(`/admin/reports/${activeView.value}`, { params });
      if (requestId !== requestSequence) return;
      report.value = response.data.data;
    }
  } catch (error) {
    if (requestId === requestSequence) {
      const message = (
        error as { response?: { data?: { error?: { message?: string | string[] } } } }
      )?.response?.data?.error?.message;
      errorMessage.value = Array.isArray(message)
        ? message.join('; ')
        : message || 'Reports could not be loaded. Please try again.';
    }
  } finally {
    if (requestId === requestSequence) loading.value = false;
  }
}

watch(
  () => route.query,
  (query) => {
    filter.value.propertyId = typeof query.propertyId === 'string' ? query.propertyId : '';
    filter.value.dateFrom = typeof query.dateFrom === 'string' ? query.dateFrom : '';
    filter.value.dateTo = typeof query.dateTo === 'string' ? query.dateTo : '';
    filter.value.status = typeof query.status === 'string' ? query.status : '';
    filter.value.page = typeof query.page === 'string' ? Number(query.page) : 1;
    filter.value.sortBy = typeof query.sortBy === 'string' ? query.sortBy : 'createdAt';
    filter.value.sortOrder = typeof query.sortOrder === 'string' ? query.sortOrder : 'DESC';
    void loadReport();
  },
  { immediate: true },
);

</script>

<template>
  <AppLayout>
    <div v-if="isAdmin" class="space-y-6">
      <header>
        <p class="text-xs font-semibold uppercase tracking-wider text-msu-maroon">University administration</p>
        <h1 class="mt-1 text-2xl font-bold text-slate-900">System Reports</h1>
        <p class="mt-1 text-sm text-slate-600">Live operational reporting across housing, billing, maintenance, and student gigs.</p>
      </header>

      <nav class="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
          :class="activeView === tab.key ? 'bg-msu-maroon text-white' : 'text-slate-600 hover:bg-slate-100'"
          @click="selectView(tab.key)"
        >
          <component :is="tab.icon" class="h-4 w-4" />
          {{ tab.label }}
        </button>
      </nav>

      <section class="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label class="text-xs font-medium text-slate-600">
          Property
          <select v-model="filter.propertyId" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" @change="updateFilters">
            <option value="">All properties</option>
            <option v-for="property in properties" :key="property.id" :value="property.id">{{ property.name }}</option>
          </select>
        </label>
        <label class="text-xs font-medium text-slate-600">
          From
          <input v-model="filter.dateFrom" type="date" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" @change="updateFilters" />
        </label>
        <label class="text-xs font-medium text-slate-600">
          To
          <input v-model="filter.dateTo" type="date" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" @change="updateFilters" />
        </label>
        <label v-if="statusOptions[activeView]" class="text-xs font-medium text-slate-600">
          Status
          <select v-model="filter.status" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" @change="updateFilters">
            <option value="">All statuses</option>
            <option v-for="status in statusOptions[activeView]" :key="status" :value="status">{{ status.replace('_', ' ') }}</option>
          </select>
        </label>
        <label v-if="sortOptions[activeView]" class="text-xs font-medium text-slate-600">
          Sort by
          <select v-model="filter.sortBy" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" @change="updateFilters">
            <option v-for="sort in sortOptions[activeView]" :key="sort" :value="sort">{{ heading(sort) }}</option>
          </select>
        </label>
        <label v-if="sortOptions[activeView]" class="text-xs font-medium text-slate-600">
          Direction
          <select v-model="filter.sortOrder" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" @change="updateFilters">
            <option value="DESC">Newest / descending</option>
            <option value="ASC">Oldest / ascending</option>
          </select>
        </label>
      </section>
      <p v-if="activeView === 'gigs'" class="text-xs text-slate-500">
        Property filters do not apply to gigs because the current gig records are not linked to properties.
      </p>

      <div v-if="errorMessage" role="alert" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {{ errorMessage }}
      </div>
      <div v-else-if="loading" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Loading live reports…
      </div>

      <template v-else>
        <section v-if="activeView === 'overview'" class="space-y-5">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article v-for="card in summaryCards" :key="card.label" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p class="text-xs font-medium text-slate-500">{{ card.label }}</p>
              <p class="mt-2 text-2xl font-bold text-slate-900">{{ card.value }}</p>
              <p class="mt-1 text-xs text-slate-600">{{ card.detail }}</p>
            </article>
          </div>
          <section class="rounded-xl border border-slate-200 bg-white p-5">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="font-bold text-slate-900">Needs Attention</h2>
              <button class="text-sm font-semibold text-msu-maroon" @click="selectView('attention')">View all</button>
            </div>
            <div v-if="!attention?.items?.length" class="py-6 text-center text-sm text-slate-500">No operational alerts require attention.</div>
            <ul v-else class="divide-y divide-slate-100">
              <li v-for="item in attention.items.slice(0, 6)" :key="item.id" class="flex items-start justify-between gap-4 py-3">
                <div>
                  <p class="text-sm font-semibold text-slate-800">{{ item.title }}</p>
                  <p class="mt-1 text-xs text-slate-600">{{ item.detail }}</p>
                </div>
                <span class="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase" :class="item.severity === 'critical' || item.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'">{{ item.severity }}</span>
              </li>
            </ul>
          </section>
        </section>

        <section v-else class="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div v-if="reportStats.length" class="grid grid-cols-2 gap-3 border-b border-slate-100 p-4 sm:grid-cols-3 lg:grid-cols-5">
            <article v-for="stat in reportStats" :key="stat.label" class="rounded-lg bg-slate-50 p-3">
              <p class="text-[11px] font-medium capitalize text-slate-500">{{ stat.label }}</p>
              <p class="mt-1 text-sm font-bold text-slate-900">{{ stat.value }}</p>
            </article>
          </div>
          <div class="border-b border-slate-100 px-5 py-4">
            <p class="text-sm text-slate-600">{{ report?.total ?? reportItems.length }} records</p>
          </div>
          <div v-if="!reportItems.length" class="p-10 text-center text-sm text-slate-500">No records match these filters.</div>
          <div v-else class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th v-for="column in columns" :key="column" class="px-4 py-3 font-semibold">{{ heading(column) }}</th></tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="row in reportItems" :key="row.id || `${row.title}-${row.createdAt}`">
                  <td v-for="column in columns" :key="column" class="whitespace-nowrap px-4 py-3 text-slate-700">
                    <span
                      v-if="column === 'status' || column === 'severity' || column === 'priority'"
                      class="rounded-full px-2 py-1 text-xs font-semibold"
                      :class="row.status === 'overdue' || row.severity === 'critical' || row.severity === 'high' || row.priority === 'urgent' ? 'bg-red-100 text-red-700' : row.status === 'pending' || row.status === 'open' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'"
                    >{{ formatCell(row, column) }}</span>
                    <span v-else>{{ formatCell(row, column) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="report?.total && report.total > filter.pageSize" class="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <button class="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40" :disabled="filter.page <= 1" @click="filter.page--; updateFilters()">Previous</button>
            <span class="text-xs text-slate-500">Page {{ filter.page }}</span>
            <button class="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40" :disabled="filter.page * filter.pageSize >= report.total" @click="filter.page++; updateFilters()">Next</button>
          </div>
          <p v-if="activeView === 'properties' || activeView === 'overview'" class="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            Property rollups use live linked records. Gig totals are system-wide because gigs have no property relationship.
          </p>
        </section>
        <section v-if="activeView === 'billing'" class="overflow-hidden rounded-xl border border-red-200 bg-white">
          <div class="border-b border-red-100 bg-red-50 px-5 py-4">
            <h2 class="font-bold text-red-900">Overdue accounts</h2>
            <p class="mt-1 text-xs text-red-800">{{ report?.totals?.overdueCount || 0 }} unpaid invoices past due</p>
          </div>
          <div v-if="!report?.overdueAccounts?.length" class="p-6 text-center text-sm text-slate-500">No overdue accounts match these filters.</div>
          <div v-else class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th v-for="column in ['invoiceNumber', 'tenant', 'property', 'dueDate', 'totalAmount', 'paidAmount']" :key="column" class="px-4 py-3 font-semibold">{{ heading(column) }}</th></tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="row in report.overdueAccounts" :key="row.id">
                  <td v-for="column in ['invoiceNumber', 'tenant', 'property', 'dueDate', 'totalAmount', 'paidAmount']" :key="column" class="whitespace-nowrap px-4 py-3 text-slate-700">{{ formatCell(row, column) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </div>
    <div v-else class="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
      Access denied. University administrators only.
    </div>
  </AppLayout>
</template>
