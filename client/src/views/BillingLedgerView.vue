<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import { useBillingStore } from '../stores/billing';
import { useNetworkStore } from '../stores/network';
import { useHousingStore } from '../stores/housing';
import { useAuthStore } from '../stores/auth';
import type { Invoice, InvoiceStatus } from '../types';
import { isAxiosError } from 'axios';
import {
  Receipt,
  Calculator,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Zap,
  Droplet,
} from 'lucide-vue-next';

const billingStore = useBillingStore();
const networkStore = useNetworkStore();
const housingStore = useHousingStore();
const authStore = useAuthStore();
const canManageBilling = computed(() => authStore.isManager || authStore.isAdmin);
const showGenerator = ref(false);
const generationError = ref<string | null>(null);
const selectedPropertyId = ref('');
const selectedUnitId = ref('');
const tenantId = ref('');
const selectedLeaseId = ref('');
const billingMonth = ref(new Date().toISOString().slice(0, 7));
const dueDate = ref(`${new Date().toISOString().slice(0, 7)}-15`);
const rentAmount = ref<number>(0);
const taxAmount = ref<number>(0);
const generationElectricity = ref<number>(0);
const generationWater = ref<number>(0);
const generationNotes = ref('');
const selectedInvoice = ref<Invoice | null>(null);
const statusNotes = ref('');
const invoicePage = ref(1);
const invoiceFilters = ref({ status: '', from: '', to: '' });

// Utility Calculator state
const electricBill = ref(3600);
const waterBill = ref(1200);
const occupants = ref(8);
const splitResult = ref<any>(null);

// Payment modal state
const selectedInvoiceId = ref<string>('');
const paymentAmount = ref<number>(0);
const paymentMethod = ref<'cash' | 'gcash' | 'bank_transfer'>('gcash');
const paymentFeedback = ref<string | null>(null);

onMounted(async () => {
  await billingStore.fetchInvoices();
  calculateSplit();
  if (canManageBilling.value) {
    await housingStore.fetchManagedProperties();
  }
});

const visibleInvoices = computed(() => billingStore.invoices.filter((invoice) => {
  const due = invoice.dueDate.slice(0, 10);
  return (!invoiceFilters.value.status || invoice.status === invoiceFilters.value.status)
    && (!invoiceFilters.value.from || due >= invoiceFilters.value.from)
    && (!invoiceFilters.value.to || due <= invoiceFilters.value.to);
}));

function updateDueDateForMonth() {
  if (billingMonth.value) dueDate.value = `${billingMonth.value}-15`;
}

async function calculateSplit() {
  splitResult.value = await billingStore.calculateUtilitySplit(
    electricBill.value,
    waterBill.value,
    occupants.value,
  );
}

async function handlePayment() {
  if (!selectedInvoiceId.value || paymentAmount.value <= 0) return;
  const result = await billingStore.recordPayment(
    selectedInvoiceId.value,
    paymentAmount.value,
    paymentMethod.value,
  );
  if (result.online) {
    paymentFeedback.value = 'Payment recorded and confirmed on server!';
  } else {
    paymentFeedback.value = result.message || 'Payment queued offline in Dexie.js';
  }
}

async function loadPropertyInvoices() {
  await billingStore.fetchInvoices(selectedPropertyId.value || undefined, {
    ...(invoiceFilters.value.status ? { status: invoiceFilters.value.status } : {}),
    ...(invoiceFilters.value.from ? { from: invoiceFilters.value.from } : {}),
    ...(invoiceFilters.value.to ? { to: invoiceFilters.value.to } : {}),
    ...(selectedPropertyId.value ? { page: invoicePage.value } : {}),
  });
  if (selectedPropertyId.value) {
    await billingStore.fetchPropertyLeases(selectedPropertyId.value);
  } else {
    billingStore.activeLeases = [];
  }
}

async function filterPropertyInvoices() {
  invoicePage.value = 1;
  await loadPropertyInvoices();
}

async function changeInvoicePage(page: number) {
  invoicePage.value = page;
  await loadPropertyInvoices();
}

async function loadSelectedPropertyLeases() {
  selectedLeaseId.value = '';
  selectedUnitId.value = '';
  tenantId.value = '';
  rentAmount.value = 0;
  if (!selectedPropertyId.value) {
    billingStore.activeLeases = [];
    return;
  }
  await billingStore.fetchPropertyLeases(selectedPropertyId.value);
}

function applyLeaseSelection() {
  const lease = billingStore.activeLeases.find((entry) => entry.id === selectedLeaseId.value);
  if (lease) {
    tenantId.value = lease.tenant.id;
    selectedUnitId.value = lease.unit.id;
    rentAmount.value = lease.monthlyRate;
  }
}

async function submitInvoiceGeneration() {
  generationError.value = null;
  if (!selectedPropertyId.value || !tenantId.value || !billingMonth.value || !dueDate.value) {
    generationError.value = 'Choose a property, tenant, billing month, and due date.';
    return;
  }
  if (!selectedLeaseId.value && rentAmount.value <= 0) {
    generationError.value = 'Enter a positive rent amount or provide an active lease ID.';
    return;
  }
  const [year, month] = billingMonth.value.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const items = [
    ...(generationElectricity.value > 0
      ? [{ description: 'Electricity', category: 'UTILITY', amount: generationElectricity.value }]
      : []),
    ...(generationWater.value > 0
      ? [{ description: 'Water', category: 'UTILITY', amount: generationWater.value }]
      : []),
  ];
  try {
    const invoice = await billingStore.generateInvoice(selectedPropertyId.value, {
      tenantId: tenantId.value,
      ...(selectedLeaseId.value ? { leaseId: selectedLeaseId.value } : { rentAmount: rentAmount.value }),
      ...(selectedUnitId.value && !selectedLeaseId.value ? { unitId: selectedUnitId.value } : {}),
      billingPeriodStart: `${billingMonth.value}-01`,
      billingPeriodEnd: `${billingMonth.value}-${String(lastDay).padStart(2, '0')}`,
      dueDate: dueDate.value,
      tax: taxAmount.value,
      items,
      ...(generationNotes.value.trim() ? { notes: generationNotes.value.trim() } : {}),
    });
    showGenerator.value = false;
    await viewInvoice(invoice.id);
  } catch (error: unknown) {
    generationError.value = isAxiosError(error)
      ? error.response?.data?.message || 'Unable to generate invoice. Please verify the tenant, lease, and property.'
      : 'Unable to generate invoice.';
  }
}

async function viewInvoice(invoiceId: string) {
  selectedInvoice.value = await billingStore.fetchInvoice(invoiceId);
  await billingStore.fetchAuditTrail(invoiceId);
}

async function updateSelectedStatus(status: InvoiceStatus) {
  if (!selectedInvoice.value) return;
  const notes = status === 'VOIDED' ? statusNotes.value.trim() : undefined;
  if (status === 'VOIDED' && !notes) {
    generationError.value = 'A reason is required to void an invoice.';
    return;
  }
  try {
    selectedInvoice.value = await billingStore.updateInvoiceStatus(
      selectedInvoice.value.id,
      status,
      notes,
    );
    statusNotes.value = '';
    await billingStore.fetchAuditTrail(selectedInvoice.value.id);
  } catch (error: unknown) {
    generationError.value = isAxiosError(error)
      ? error.response?.data?.message || 'Unable to update invoice status.'
      : 'Unable to update invoice status.';
  }
}

function statusClass(status: InvoiceStatus) {
  return {
    DRAFT: 'bg-slate-100 text-slate-700',
    ISSUED: 'bg-amber-100 text-amber-800',
    PAID: 'bg-emerald-100 text-emerald-800',
    OVERDUE: 'bg-red-100 text-red-800',
    VOIDED: 'bg-slate-200 text-slate-600',
  }[status];
}

function currency(amount: number | string) {
  return Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
</script>

<template>
  <AppLayout>
    <div class="space-y-8">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Billing Ledger & Utility Splitting</h1>
        <p class="text-xs text-slate-600">Transparent billing history, shared meter calculation, and offline-resilient payment logging.</p>
      </div>

      <section v-if="canManageBilling" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="font-bold text-slate-800">Property billing management</h2>
            <p class="mt-1 text-xs text-slate-500">Create monthly or manual tenant invoices and inspect their audit history.</p>
          </div>
          <button
            @click="showGenerator = true; generationError = null"
            class="rounded-lg bg-msu-maroon px-4 py-2 text-xs font-bold text-white hover:opacity-90"
          >
            Generate Monthly Billing
          </button>
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-4">
          <select v-model="selectedPropertyId" @change="filterPropertyInvoices" class="rounded border border-slate-300 bg-white px-3 py-2 text-xs">
            <option value="">All managed properties</option>
            <option v-for="property in housingStore.properties" :key="property.id" :value="property.id">{{ property.name }}</option>
          </select>
          <select v-model="invoiceFilters.status" @change="filterPropertyInvoices" class="rounded border border-slate-300 bg-white px-3 py-2 text-xs">
            <option value="">All statuses</option>
            <option v-for="status in ['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'VOIDED']" :key="status" :value="status">{{ status }}</option>
          </select>
          <input v-model="invoiceFilters.from" type="date" aria-label="Due date from" @change="filterPropertyInvoices" class="rounded border border-slate-300 px-3 py-2 text-xs" />
          <input v-model="invoiceFilters.to" type="date" aria-label="Due date to" @change="filterPropertyInvoices" class="rounded border border-slate-300 px-3 py-2 text-xs" />
        </div>
      </section>

      <div v-if="showGenerator" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
        <form @submit.prevent="submitInvoiceGeneration" class="w-full max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-xl">
          <div class="flex items-start justify-between">
            <div>
              <h2 class="text-lg font-bold text-slate-900">Generate Monthly Billing</h2>
              <p class="mt-1 text-xs text-slate-500">Select a billing cycle and tenant. An active lease supplies its rent and unit.</p>
            </div>
            <button type="button" aria-label="Close" @click="showGenerator = false" class="text-xl text-slate-500">×</button>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="space-y-1 text-xs font-medium text-slate-600">
              Property
              <select v-model="selectedPropertyId" required @change="loadSelectedPropertyLeases" class="w-full rounded border border-slate-300 bg-white px-3 py-2">
                <option value="" disabled>Select property</option>
                <option v-for="property in housingStore.properties" :key="property.id" :value="property.id">{{ property.name }}</option>
              </select>
            </label>
            <label class="space-y-1 text-xs font-medium text-slate-600">
              Billing month
              <input v-model="billingMonth" type="month" required @change="updateDueDateForMonth" class="w-full rounded border border-slate-300 px-3 py-2" />
            </label>
            <label class="space-y-1 text-xs font-medium text-slate-600">
              Tenant user ID
              <input v-model="tenantId" required class="w-full rounded border border-slate-300 px-3 py-2" placeholder="Tenant UUID" />
            </label>
            <label class="space-y-1 text-xs font-medium text-slate-600">
              Existing lease (optional; rent and tenant are filled automatically)
              <select v-model="selectedLeaseId" @change="applyLeaseSelection" class="w-full rounded border border-slate-300 bg-white px-3 py-2">
                <option value="">Manual billing</option>
                <option v-for="lease in billingStore.activeLeases" :key="lease.id" :value="lease.id">
                  {{ lease.tenant.fullName }} · {{ lease.unit.roomNumber }} · ₱{{ currency(lease.monthlyRate) }}
                </option>
              </select>
            </label>
            <label class="space-y-1 text-xs font-medium text-slate-600">
              Unit (optional)
              <select v-model="selectedUnitId" :disabled="!!selectedLeaseId" class="w-full rounded border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100">
                <option value="">No specific unit</option>
                <option
                  v-for="unit in housingStore.properties.find((property) => property.id === selectedPropertyId)?.units || []"
                  :key="unit.id"
                  :value="unit.id"
                >{{ unit.roomNumber }} · ₱{{ currency(unit.monthlyRent) }}/month</option>
              </select>
            </label>
            <label class="space-y-1 text-xs font-medium text-slate-600">
              Manual rent amount (₱)
              <input v-model.number="rentAmount" type="number" min="0" step="0.01" :disabled="!!selectedLeaseId" class="w-full rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
            </label>
            <label class="space-y-1 text-xs font-medium text-slate-600">
              Due date
              <input v-model="dueDate" type="date" required class="w-full rounded border border-slate-300 px-3 py-2" />
            </label>
            <label class="space-y-1 text-xs font-medium text-slate-600">
              Tax (₱)
              <input v-model.number="taxAmount" type="number" min="0" step="0.01" class="w-full rounded border border-slate-300 px-3 py-2" />
            </label>
            <div class="text-xs text-slate-600">
              Utility line items (₱)
              <div class="mt-1 grid grid-cols-2 gap-2">
                <input v-model.number="generationElectricity" type="number" min="0" step="0.01" aria-label="Electricity amount" class="w-full rounded border border-slate-300 px-3 py-2" placeholder="Electricity" />
                <input v-model.number="generationWater" type="number" min="0" step="0.01" aria-label="Water amount" class="w-full rounded border border-slate-300 px-3 py-2" placeholder="Water" />
              </div>
            </div>
            <label class="space-y-1 text-xs font-medium text-slate-600 sm:col-span-2">
              Billing or re-issue notes
              <textarea v-model="generationNotes" rows="2" maxlength="2000" class="w-full rounded border border-slate-300 px-3 py-2" placeholder="Reason for re-issuing a voided billing period, if applicable"></textarea>
            </label>
          </div>
          <p v-if="generationError" role="alert" class="rounded bg-red-50 p-3 text-xs text-red-700">{{ generationError }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" @click="showGenerator = false" class="rounded border border-slate-300 px-4 py-2 text-xs font-semibold">Cancel</button>
            <button type="submit" class="rounded bg-msu-maroon px-4 py-2 text-xs font-bold text-white">Generate invoice</button>
          </div>
        </form>
      </div>

      <!-- Splitter Tool & Quick Demo -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Utility Calculator -->
        <div class="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div class="flex items-center space-x-2 text-slate-800 font-bold text-sm border-b pb-2">
            <Calculator class="w-4 h-4 text-msu-maroon" />
            <span>Shared Utility Splitter</span>
          </div>

          <div class="space-y-3 text-xs">
            <div>
              <label class="font-medium text-slate-600 flex items-center mb-1">
                <Zap class="w-3.5 h-3.5 text-amber-500 mr-1" />
                Total Dorm Electric Bill (₱)
              </label>
              <input
                v-model.number="electricBill"
                type="number"
                @input="calculateSplit"
                class="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-msu-maroon focus:outline-none"
              />
            </div>

            <div>
              <label class="font-medium text-slate-600 flex items-center mb-1">
                <Droplet class="w-3.5 h-3.5 text-blue-500 mr-1" />
                Total Dorm Water Bill (₱)
              </label>
              <input
                v-model.number="waterBill"
                type="number"
                @input="calculateSplit"
                class="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-msu-maroon focus:outline-none"
              />
            </div>

            <div>
              <label class="font-medium text-slate-600 mb-1 block">Active Room Occupants</label>
              <input
                v-model.number="occupants"
                type="number"
                min="1"
                @input="calculateSplit"
                class="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-msu-maroon focus:outline-none"
              />
            </div>

            <div v-if="splitResult" class="bg-emerald-50 border border-emerald-200 p-3 rounded-lg mt-3 text-emerald-900">
              <div class="font-bold text-xs uppercase text-emerald-800">Calculated Share Per Student</div>
              <div class="text-xl font-extrabold text-emerald-700 mt-1">₱{{ splitResult.totalUtilityShare }}</div>
              <div class="text-[11px] text-emerald-700 mt-0.5">
                (Electricity: ₱{{ splitResult.electricShare }} + Water: ₱{{ splitResult.waterShare }})
              </div>
            </div>
          </div>
        </div>

        <!-- Offline Payment Logger Demo -->
        <div class="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div class="flex items-center justify-between border-b pb-2">
            <div class="flex items-center space-x-2 text-slate-800 font-bold text-sm">
              <CreditCard class="w-4 h-4 text-emerald-600" />
              <span>Payment Logger (Offline-Resilient)</span>
            </div>
            <span class="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              {{ networkStore.isOnline ? 'Online mode' : 'Offline Queue active' }}
            </span>
          </div>

          <div v-if="paymentFeedback" class="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center justify-between">
            <span>{{ paymentFeedback }}</span>
            <button @click="paymentFeedback = null" class="text-xs font-bold underline ml-2">Dismiss</button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label class="font-medium text-slate-600 block mb-1">Invoice Reference</label>
              <input
                v-model="selectedInvoiceId"
                placeholder="e.g. inv-uuid-or-id"
                class="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-msu-maroon"
              />
            </div>

            <div>
              <label class="font-medium text-slate-600 block mb-1">Payment Amount (₱)</label>
              <input
                v-model.number="paymentAmount"
                type="number"
                placeholder="2100"
                class="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-msu-maroon"
              />
            </div>

            <div>
              <label class="font-medium text-slate-600 block mb-1">Method</label>
              <select
                v-model="paymentMethod"
                class="w-full px-3 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-msu-maroon"
              >
                <option value="cash">Cash (On-site)</option>
                <option value="gcash">GCash</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          <button
            @click="handlePayment"
            class="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
          >
            Record Payment Now (Auto-syncs via Dexie)
          </button>
        </div>
      </div>

      <!-- Invoices Table -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 class="font-bold text-sm text-slate-800">Monthly Invoices & Ledger</h2>
        </div>
        <div v-if="selectedPropertyId && billingStore.pagination.pageCount > 1" class="flex items-center justify-end gap-3 text-xs text-slate-600">
          <span>Page {{ billingStore.pagination.page }} of {{ billingStore.pagination.pageCount }}</span>
          <button
            :disabled="billingStore.pagination.page <= 1"
            @click="changeInvoicePage(billingStore.pagination.page - 1)"
            class="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >Previous</button>
          <button
            :disabled="billingStore.pagination.page >= billingStore.pagination.pageCount"
            @click="changeInvoicePage(billingStore.pagination.page + 1)"
            class="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >Next</button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th class="px-5 py-3">Invoice #</th>
                <th class="px-5 py-3">Tenant</th>
                <th class="px-5 py-3">Billing period</th>
                <th class="px-5 py-3">Total</th>
                <th class="px-5 py-3">Status</th>
                <th class="px-5 py-3">Due Date</th>
                <th class="px-5 py-3">Details</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="visibleInvoices.length === 0">
                <td colspan="7" class="px-5 py-8 text-center text-slate-400">
                  No billing records found.
                </td>
              </tr>
              <tr v-for="inv in visibleInvoices" :key="inv.id" class="hover:bg-slate-50">
                <td class="px-5 py-3 font-semibold text-slate-800">{{ inv.invoiceNumber }}</td>
                <td class="px-5 py-3">{{ inv.tenant?.fullName || inv.tenant?.email }}</td>
                <td class="px-5 py-3">{{ inv.billingPeriodStart || '—' }} – {{ inv.billingPeriodEnd || '—' }}</td>
                <td class="px-5 py-3 font-bold text-slate-900">₱{{ currency(inv.totalAmount) }}</td>
                <td class="px-5 py-3">
                  <span
                    :class="[statusClass(inv.status), 'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider']"
                  >
                    {{ inv.status.replace('_', ' ') }}
                  </span>
                </td>
                <td class="px-5 py-3 text-slate-500">{{ inv.dueDate }}</td>
                <td class="px-5 py-3">
                  <button @click="viewInvoice(inv.id)" class="font-semibold text-msu-maroon underline">View & audit</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <section v-if="selectedInvoice" class="grid gap-6 lg:grid-cols-2">
          <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
              <div>
                <h2 class="font-bold text-slate-900">{{ selectedInvoice.invoiceNumber }}</h2>
                <p class="mt-1 text-xs text-slate-500">{{ selectedInvoice.tenant?.fullName }} · Due {{ selectedInvoice.dueDate }}</p>
              </div>
              <button @click="selectedInvoice = null" aria-label="Close invoice details" class="text-xl text-slate-500">×</button>
            </div>
            <div class="mt-3 divide-y divide-slate-100">
              <div v-for="item in selectedInvoice.items || []" :key="item.id" class="flex justify-between py-2 text-sm">
                <span class="text-slate-600">{{ item.description }} <small class="text-slate-400">({{ item.category }})</small></span>
                <span class="font-semibold">₱{{ currency(item.amount) }}</span>
              </div>
            </div>
            <div class="mt-3 space-y-1 border-t pt-3 text-right text-sm">
              <p>Subtotal: ₱{{ currency(selectedInvoice.subtotal) }}</p>
              <p>Tax: ₱{{ currency(selectedInvoice.tax) }}</p>
              <p class="font-bold">Total: ₱{{ currency(selectedInvoice.totalAmount) }}</p>
            </div>
            <p v-if="generationError" role="alert" class="mt-3 rounded bg-red-50 p-3 text-xs text-red-700">{{ generationError }}</p>
            <div v-if="canManageBilling" class="mt-4 flex flex-wrap gap-2">
              <button v-if="selectedInvoice.status === 'DRAFT'" @click="updateSelectedStatus('ISSUED')" class="rounded bg-amber-700 px-3 py-2 text-xs font-semibold text-white">Issue</button>
              <button v-if="['ISSUED', 'OVERDUE'].includes(selectedInvoice.status)" @click="updateSelectedStatus('PAID')" class="rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">Mark paid</button>
              <button v-if="selectedInvoice.status === 'ISSUED'" @click="updateSelectedStatus('OVERDUE')" class="rounded bg-red-700 px-3 py-2 text-xs font-semibold text-white">Mark overdue</button>
              <input v-if="['DRAFT', 'ISSUED', 'OVERDUE'].includes(selectedInvoice.status)" v-model="statusNotes" aria-label="Reason for voiding" placeholder="Void reason (required)" class="min-w-40 flex-1 rounded border border-slate-300 px-3 py-2 text-xs" />
              <button v-if="['DRAFT', 'ISSUED', 'OVERDUE'].includes(selectedInvoice.status)" @click="updateSelectedStatus('VOIDED')" class="rounded border border-red-300 px-3 py-2 text-xs font-semibold text-red-700">Void invoice</button>
            </div>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 class="border-b pb-3 font-bold text-slate-900">Audit History</h2>
            <ol class="mt-4 space-y-4">
              <li v-for="entry in billingStore.auditTrail" :key="entry.id" class="relative border-l-2 border-slate-200 pl-4">
                <span class="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-msu-maroon"></span>
                <p class="text-xs font-bold text-slate-800">{{ entry.action.replace('_', ' ') }}</p>
                <p class="mt-1 text-[11px] text-slate-500">{{ new Date(entry.createdAt).toLocaleString() }}</p>
                <p class="text-[11px] text-slate-600">
                  {{ entry.actor?.fullName || entry.actor?.email || entry.actorType }} · {{ entry.actorType }}
                </p>
                <p class="mt-1 text-[11px] text-slate-500">
                  {{ entry.snapshot.status }} · total ₱{{ currency(String(entry.snapshot.totalAmount || 0)) }}
                  <span v-if="entry.metadata.notes"> · {{ entry.metadata.notes }}</span>
                </p>
              </li>
              <li v-if="billingStore.auditTrail.length === 0" class="text-xs text-slate-400">No audit events available.</li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  </AppLayout>
</template>
