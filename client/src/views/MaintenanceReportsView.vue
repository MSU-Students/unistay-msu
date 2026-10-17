<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import apiClient from '../api/client';
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, RefreshCw, Wrench } from 'lucide-vue-next';

interface ReportTicket {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  ageDays: number;
  isOverdue: boolean;
  needsEscalation: boolean;
  property?: { id: string; name: string };
  reporter?: { fullName?: string };
}
interface CountItem { label: string; count: number }
interface ReportData {
  generatedAt: string;
  thresholds: { longPendingDays: number; overdueDays: number };
  summary: { total: number; open: number; overdue: number; resolved: number; needsEscalation: number };
  properties: { id: string; name: string }[];
  volumeByProperty: CountItem[];
  volumeByCategory: CountItem[];
  monthlyTrend: { month: string; count: number }[];
  tickets: ReportTicket[];
}

type TicketTab = 'all' | 'open' | 'overdue' | 'resolved';
const report = ref<ReportData | null>(null);
const loading = ref(false);
const errorMessage = ref('');
const startDate = ref('');
const endDate = ref('');
const propertyId = ref('');
const activeTab = ref<TicketTab>('all');
const ticketTabs = [
  { key: 'all', label: 'All tickets' },
  { key: 'open', label: 'Open' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'resolved', label: 'Resolved' },
] as const;
const escalationTickets = computed(() => (report.value?.tickets ?? []).filter((ticket) => ticket.needsEscalation));

const visibleTickets = computed(() => {
  const tickets = report.value?.tickets ?? [];
  if (activeTab.value === 'open') return tickets.filter((t) => t.status === 'open' || t.status === 'in_progress');
  if (activeTab.value === 'overdue') return tickets.filter((t) => t.isOverdue);
  if (activeTab.value === 'resolved') return tickets.filter((t) => t.status === 'resolved' || t.status === 'closed');
  return tickets;
});
const maxPropertyCount = computed(() => Math.max(1, ...(report.value?.volumeByProperty.map((x) => x.count) ?? [1])));
const maxCategoryCount = computed(() => Math.max(1, ...(report.value?.volumeByCategory.map((x) => x.count) ?? [1])));
const maxMonthlyCount = computed(() => Math.max(1, ...(report.value?.monthlyTrend.map((x) => x.count) ?? [1])));

async function loadReport() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const params: Record<string, string> = {};
    if (startDate.value) params.startDate = startDate.value;
    if (endDate.value) params.endDate = endDate.value;
    if (propertyId.value) params.propertyId = propertyId.value;
    const response = await apiClient.get('/maintenance/admin/reports', { params });
    report.value = response.data.data as ReportData;
  } catch (error: any) {
    errorMessage.value = error?.response?.status === 403
      ? 'This report is only available to university administrators.'
      : 'Could not load maintenance reports. Check that the API is running and you are signed in as a university admin.';
  } finally {
    loading.value = false;
  }
}

function clearFilters() {
  startDate.value = '';
  endDate.value = '';
  propertyId.value = '';
  activeTab.value = 'all';
  loadReport();
}
function prettyStatus(status: string) {
  return status.replace('_', ' ');
}
function prettyMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}
function prettyDate(value: string) {
  return new Date(value).toLocaleDateString();
}

onMounted(loadReport);
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.16em] text-msu-maroon">University Admin</p>
          <h1 class="mt-1 text-2xl font-bold text-slate-900">Maintenance Reports & Oversight</h1>
          <p class="mt-1 max-w-3xl text-sm text-slate-600">Review ticket status, service trends, and long-pending maintenance issues that may need escalation.</p>
        </div>
        <button @click="loadReport" :disabled="loading" class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw class="h-4 w-4" :class="loading ? 'animate-spin' : ''" /> Refresh report
        </button>
      </div>

      <div v-if="errorMessage" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{{ errorMessage }}</div>

      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="mb-3 flex items-center gap-2"><CalendarDays class="h-4 w-4 text-slate-500" /><h2 class="text-sm font-bold text-slate-900">Report filters</h2></div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label class="text-xs font-semibold text-slate-600">From date
            <input v-model="startDate" type="date" :max="endDate || undefined" class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
          </label>
          <label class="text-xs font-semibold text-slate-600">To date
            <input v-model="endDate" type="date" :min="startDate || undefined" class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
          </label>
          <label class="text-xs font-semibold text-slate-600">Property
            <select v-model="propertyId" class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800">
              <option value="">All properties</option>
              <option v-for="property in report?.properties ?? []" :key="property.id" :value="property.id">{{ property.name }}</option>
            </select>
          </label>
          <div class="flex items-end gap-2">
            <button @click="loadReport" class="flex-1 rounded-lg bg-msu-maroon px-4 py-2 text-xs font-bold text-white hover:bg-msu-darkmaroon">Apply filters</button>
            <button @click="clearFilters" class="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Clear</button>
          </div>
        </div>
        <p class="mt-3 text-[11px] text-slate-500">Leave dates blank to include the full ticket history. Volume and trend reports include open, in-progress, resolved, and closed tickets.</p>
      </section>

      <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex items-center justify-between text-xs font-semibold text-slate-500"><span>Total tickets in history</span><ClipboardList class="h-4 w-4" /></div>
          <p class="mt-3 text-3xl font-bold text-slate-900">{{ report?.summary.total ?? '—' }}</p><p class="mt-1 text-[11px] text-slate-500">Matches the selected filters</p>
        </div>
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div class="flex items-center justify-between text-xs font-semibold text-amber-800"><span>Open / in progress</span><Wrench class="h-4 w-4" /></div>
          <p class="mt-3 text-3xl font-bold text-amber-950">{{ report?.summary.open ?? '—' }}</p><p class="mt-1 text-[11px] text-amber-800">Needs work or follow-up</p>
        </div>
        <div class="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <div class="flex items-center justify-between text-xs font-semibold text-red-800"><span>Overdue tickets</span><AlertTriangle class="h-4 w-4" /></div>
          <p class="mt-3 text-3xl font-bold text-red-950">{{ report?.summary.overdue ?? '—' }}</p><p class="mt-1 text-[11px] text-red-800">Unresolved for {{ report?.thresholds.overdueDays ?? 7 }}+ days</p>
        </div>
        <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div class="flex items-center justify-between text-xs font-semibold text-emerald-800"><span>Resolved / closed</span><CheckCircle2 class="h-4 w-4" /></div>
          <p class="mt-3 text-3xl font-bold text-emerald-950">{{ report?.summary.resolved ?? '—' }}</p><p class="mt-1 text-[11px] text-emerald-800">Completed tickets in history</p>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="mb-4"><h2 class="text-sm font-bold text-slate-900">Ticket volume by property</h2><p class="mt-1 text-xs text-slate-500">All ticket statuses in the selected period</p></div>
          <div v-if="!report?.volumeByProperty.length" class="py-8 text-center text-xs text-slate-400">No property ticket data for these filters.</div>
          <div v-else class="space-y-4">
            <div v-for="item in report.volumeByProperty" :key="item.label">
              <div class="mb-1 flex items-center justify-between gap-3 text-xs"><span class="truncate font-medium text-slate-700">{{ item.label }}</span><span class="font-bold tabular-nums text-slate-900">{{ item.count }}</span></div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-msu-maroon" :style="{ width: `${item.count / maxPropertyCount * 100}%` }"></div></div>
            </div>
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="mb-4"><h2 class="text-sm font-bold text-slate-900">Ticket volume by issue category</h2><p class="mt-1 text-xs text-slate-500">Helps identify recurring service concerns</p></div>
          <div v-if="!report?.volumeByCategory.length" class="py-8 text-center text-xs text-slate-400">No category data for these filters.</div>
          <div v-else class="space-y-4">
            <div v-for="item in report.volumeByCategory" :key="item.label">
              <div class="mb-1 flex items-center justify-between gap-3 text-xs"><span class="font-medium capitalize text-slate-700">{{ item.label }}</span><span class="font-bold tabular-nums text-slate-900">{{ item.count }}</span></div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-slate-700" :style="{ width: `${item.count / maxCategoryCount * 100}%` }"></div></div>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="mb-4"><h2 class="text-sm font-bold text-slate-900">Ticket trend over time</h2><p class="mt-1 text-xs text-slate-500">Monthly ticket creation count, including every status in the selected history</p></div>
        <div v-if="!report?.monthlyTrend.length" class="py-8 text-center text-xs text-slate-400">No trend data available.</div>
        <div v-else class="overflow-x-auto pb-2"><div class="flex min-w-full items-end gap-3" style="min-width: max-content; height: 180px">
          <div v-for="item in report.monthlyTrend" :key="item.month" class="flex h-full w-12 flex-col items-center justify-end gap-2">
            <span class="text-[10px] font-bold text-slate-600">{{ item.count }}</span>
            <div class="w-7 rounded-t bg-msu-maroon/85" :style="{ height: `${Math.max(5, item.count / maxMonthlyCount * 120)}px` }" :title="`${prettyMonth(item.month)}: ${item.count} tickets`"></div>
            <span class="whitespace-nowrap text-[10px] text-slate-500">{{ prettyMonth(item.month) }}</span>
          </div>
        </div></div>
      </section>

      <section class="rounded-xl border border-red-200 bg-white shadow-sm">
        <div class="flex flex-col gap-2 border-b border-red-100 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 class="flex items-center gap-2 text-sm font-bold text-red-950"><AlertTriangle class="h-4 w-4" /> Long-pending items for escalation</h2><p class="mt-1 text-xs text-red-800">Unresolved for {{ report?.thresholds.longPendingDays ?? 3 }} or more days. Overdue items are marked separately.</p></div>
          <span class="w-fit rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-900">{{ report?.summary.needsEscalation ?? 0 }} flagged</span>
        </div>
        <div v-if="!escalationTickets.length" class="p-6 text-center text-xs text-slate-500">No long-pending tickets need escalation under the current threshold.</div>
        <div v-else class="overflow-x-auto"><table class="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead class="bg-white text-[10px] uppercase tracking-wider text-slate-500"><tr><th class="px-4 py-3">Issue</th><th class="px-4 py-3">Property</th><th class="px-4 py-3">Age</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Flag</th></tr></thead>
          <tbody class="divide-y divide-slate-100"><tr v-for="ticket in escalationTickets" :key="ticket.id" class="hover:bg-slate-50">
            <td class="px-4 py-3"><div class="font-semibold text-slate-900">{{ ticket.title }}</div><div class="mt-1 text-slate-500 capitalize">{{ ticket.category }} · {{ ticket.priority }} priority</div></td>
            <td class="px-4 py-3 text-slate-600">{{ ticket.property?.name ?? 'Unknown property' }}</td><td class="px-4 py-3 font-semibold text-slate-700">{{ ticket.ageDays }} days</td>
            <td class="px-4 py-3 capitalize text-slate-600">{{ prettyStatus(ticket.status) }}</td><td class="px-4 py-3"><span :class="ticket.isOverdue ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'" class="rounded-full px-2 py-1 text-[10px] font-bold">{{ ticket.isOverdue ? 'Overdue' : 'Escalate' }}</span></td>
          </tr></tbody></table></div>
      </section>

      <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 p-4"><h2 class="text-sm font-bold text-slate-900">Maintenance ticket history</h2><p class="mt-1 text-xs text-slate-500">Select a status to review open, overdue, resolved, or all matching tickets.</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button v-for="tab in ticketTabs" :key="tab.key" @click="activeTab = tab.key" :class="activeTab === tab.key ? 'bg-msu-maroon text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'" class="rounded-full px-3 py-1.5 text-xs font-semibold">{{ tab.label }}</button>
          </div>
        </div>
        <div v-if="loading" class="p-8 text-center text-xs text-slate-500">Loading report...</div>
        <div v-else-if="!visibleTickets.length" class="p-8 text-center text-xs text-slate-500">No tickets match this view and the selected filters.</div>
        <div v-else class="overflow-x-auto"><table class="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead class="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th class="px-4 py-3">Ticket</th><th class="px-4 py-3">Property</th><th class="px-4 py-3">Category</th><th class="px-4 py-3">Created</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Age / Alert</th></tr></thead>
          <tbody class="divide-y divide-slate-100"><tr v-for="ticket in visibleTickets" :key="ticket.id" class="hover:bg-slate-50">
            <td class="px-4 py-3"><div class="font-semibold text-slate-900">{{ ticket.title }}</div><div class="mt-1 max-w-xs truncate text-slate-500">{{ ticket.description }}</div></td>
            <td class="px-4 py-3 text-slate-600">{{ ticket.property?.name ?? 'Unknown property' }}</td><td class="px-4 py-3 capitalize text-slate-600">{{ ticket.category }}</td><td class="px-4 py-3 whitespace-nowrap text-slate-600">{{ prettyDate(ticket.createdAt) }}</td>
            <td class="px-4 py-3"><span class="rounded-full px-2 py-1 text-[10px] font-bold capitalize" :class="ticket.status === 'resolved' || ticket.status === 'closed' ? 'bg-emerald-100 text-emerald-800' : ticket.isOverdue ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'">{{ prettyStatus(ticket.status) }}</span></td>
            <td class="px-4 py-3"><div class="font-semibold text-slate-700">{{ ticket.ageDays }} days</div><div v-if="ticket.isOverdue" class="mt-1 font-bold text-red-700">Overdue</div><div v-else-if="ticket.needsEscalation" class="mt-1 font-semibold text-amber-700">Escalation suggested</div><span v-else class="text-slate-400">—</span></td>
          </tr></tbody></table></div>
        <div class="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">Showing {{ visibleTickets.length }} of {{ report?.tickets.length ?? 0 }} tickets returned by the report.</div>
      </section>
      <p v-if="report" class="text-right text-[10px] text-slate-400">Report generated {{ new Date(report.generatedAt).toLocaleString() }} · Trend counts use ticket creation dates across all statuses.</p>
    </div>
  </AppLayout>
</template>
