<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import InvoiceLedger from '../components/billing/InvoiceLedger.vue';
import { useBillingStore } from '../stores/billing';
import { useNetworkStore } from '../stores/network';
import { useAuthStore } from '../stores/auth';
import { useHousingStore } from '../stores/housing';
import { FinancePaymentStatus, FinanceSummary, Invoice } from '../types';
import {
  Calculator,
  CreditCard,
  Droplet,
  Zap,
} from 'lucide-vue-next';

interface UtilitySplitResult {
  electricShare: number;
  waterShare: number;
  totalUtilityShare: number;
}

const billingStore = useBillingStore();
const networkStore = useNetworkStore();
const authStore = useAuthStore();
const housingStore = useHousingStore();

const electricBill = ref(3600);
const waterBill = ref(1200);
const occupants = ref(8);
const splitResult = ref<UtilitySplitResult | null>(null);
const splitError = ref<string | null>(null);
const selectedInvoiceId = ref('');
const paymentAmount = ref(0);
const paymentMethod = ref<'cash' | 'gcash' | 'bank_transfer'>('gcash');
const paymentFeedback = ref<string | null>(null);
const paymentError = ref<string | null>(null);
const financeSummary = ref<FinanceSummary | null>(null);
const summaryLoading = ref(false);
const summaryError = ref<string | null>(null);
const summaryPropertyId = ref('');
const summaryStartDate = ref('');
const summaryEndDate = ref('');
const summaryStatus = ref<FinancePaymentStatus>('all');

const selectedInvoice = computed(() =>
  billingStore.invoices.find((invoice: Invoice) => invoice.id === selectedInvoiceId.value),
);
const selectedBalance = computed(() =>
  selectedInvoice.value
    ? Math.max(0, Number(selectedInvoice.value.totalAmount) - Number(selectedInvoice.value.paidAmount))
    : 0,
);

onMounted(() => {
  void billingStore.fetchInvoices();
  void calculateSplit();
  if (authStore.isAdmin) {
    void housingStore.fetchProperties();
    void fetchFinanceSummary();
  }
});

watch(selectedInvoiceId, () => {
  paymentAmount.value = selectedBalance.value;
});

async function calculateSplit() {
  splitError.value = null;
  try {
    splitResult.value = await billingStore.calculateUtilitySplit(
      electricBill.value,
      waterBill.value,
      occupants.value,
    );
  } catch (error) {
    splitResult.value = null;
    splitError.value =
      error instanceof Error ? error.message : 'Unable to calculate the utility split.';
  }
}

async function handlePayment() {
  paymentFeedback.value = null;
  paymentError.value = null;

  if (!selectedInvoiceId.value || paymentAmount.value <= 0 || paymentAmount.value > selectedBalance.value) {
    paymentError.value = 'Choose an invoice and enter an amount no greater than its outstanding balance.';
    return;
  }

  try {
    const result = await billingStore.recordPayment(
      selectedInvoiceId.value,
      paymentAmount.value,
      paymentMethod.value,
    );
    paymentFeedback.value = result.online
      ? 'Payment recorded and confirmed on server.'
      : result.message || 'Payment queued offline and will synchronize when reconnected.';
    paymentAmount.value = selectedBalance.value;
  } catch (error) {
    paymentError.value = error instanceof Error ? error.message : 'Unable to record payment.';
  }
}

function formatMoney(value: number | string) {
  return Number(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function outstandingBalance(invoice: Invoice) {
  return Math.max(0, Number(invoice.totalAmount) - Number(invoice.paidAmount));
}

async function fetchFinanceSummary() {
  summaryLoading.value = true;
  summaryError.value = null;
  try {
    financeSummary.value = await billingStore.fetchFinanceSummary({
      propertyId: summaryPropertyId.value || undefined,
      startDate: summaryStartDate.value || undefined,
      endDate: summaryEndDate.value || undefined,
      status: summaryStatus.value,
    });
  } catch (error) {
    financeSummary.value = null;
    summaryError.value = error instanceof Error ? error.message : 'Unable to load the finance summary.';
  } finally {
    summaryLoading.value = false;
  }
}
</script>

<template>
  <AppLayout>
    <div class="space-y-8">
      <div class="print-hidden">
        <h1 class="text-2xl font-bold text-slate-900">Rent & Payment Records</h1>
        <p class="text-xs text-slate-600">
          Review monthly charges, due dates, payment history, and current balances.
        </p>
      </div>

      <section v-if="authStore.isAdmin" class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-slate-900">Financial activity summary</h2>
            <p class="text-xs text-slate-600">Review collected payments and outstanding invoice balances across properties. Date ranges use payment dates for collections and invoice dates for balances.</p>
          </div>
          <button
            @click="fetchFinanceSummary"
            :disabled="summaryLoading"
            class="rounded-lg bg-msu-maroon px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {{ summaryLoading ? 'Loading...' : 'Apply filters' }}
          </button>
        </div>

        <div class="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <label class="font-medium text-slate-600">
            <span class="mb-1 block">Property</span>
            <select v-model="summaryPropertyId" class="w-full rounded border border-slate-300 bg-white px-3 py-2">
              <option value="">All properties</option>
              <option v-for="property in housingStore.properties" :key="property.id" :value="property.id">
                {{ property.name }}
              </option>
            </select>
          </label>
          <label class="font-medium text-slate-600">
            <span class="mb-1 block">From date</span>
            <input v-model="summaryStartDate" type="date" class="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <label class="font-medium text-slate-600">
            <span class="mb-1 block">Through date</span>
            <input v-model="summaryEndDate" type="date" :min="summaryStartDate || undefined" class="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <label class="font-medium text-slate-600">
            <span class="mb-1 block">Payment status</span>
            <select v-model="summaryStatus" class="w-full rounded border border-slate-300 bg-white px-3 py-2">
              <option value="all">All statuses</option>
              <option value="unpaid">Unpaid</option>
              <option value="partially_paid">Partially paid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
        </div>

        <p v-if="summaryError" role="alert" class="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {{ summaryError }}
        </p>
        <div v-if="financeSummary" class="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-live="polite">
          <article class="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p class="text-xs font-semibold uppercase text-emerald-800">Total collected</p>
            <p class="mt-1 text-2xl font-extrabold text-emerald-900">₱{{ formatMoney(financeSummary.totalCollected) }}</p>
          </article>
          <article class="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p class="text-xs font-semibold uppercase text-amber-800">Outstanding</p>
            <p class="mt-1 text-2xl font-extrabold text-amber-900">₱{{ formatMoney(financeSummary.totalOutstanding) }}</p>
          </article>
          <article class="rounded-lg border border-red-200 bg-red-50 p-4">
            <p class="text-xs font-semibold uppercase text-red-800">Overdue</p>
            <p class="mt-1 text-2xl font-extrabold text-red-900">₱{{ formatMoney(financeSummary.totalOverdue) }}</p>
          </article>
        </div>
      </section>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3 print-hidden">
        <section class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center space-x-2 border-b pb-2 text-sm font-bold text-slate-800">
            <Calculator class="h-4 w-4 text-msu-maroon" />
            <span>Shared Utility Splitter</span>
          </div>
          <div class="space-y-3 text-xs">
            <label class="block font-medium text-slate-600">
              <span class="mb-1 flex items-center"><Zap class="mr-1 h-3.5 w-3.5 text-amber-500" />Total dorm electric bill (₱)</span>
              <input v-model.number="electricBill" type="number" min="0" @input="calculateSplit" class="w-full rounded border border-slate-300 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-msu-maroon" />
            </label>
            <label class="block font-medium text-slate-600">
              <span class="mb-1 flex items-center"><Droplet class="mr-1 h-3.5 w-3.5 text-blue-500" />Total dorm water bill (₱)</span>
              <input v-model.number="waterBill" type="number" min="0" @input="calculateSplit" class="w-full rounded border border-slate-300 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-msu-maroon" />
            </label>
            <label class="block font-medium text-slate-600">
              <span class="mb-1 block">Active room occupants</span>
              <input v-model.number="occupants" type="number" min="1" @input="calculateSplit" class="w-full rounded border border-slate-300 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-msu-maroon" />
            </label>
            <div v-if="splitResult" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
              <div class="text-xs font-bold uppercase text-emerald-800">Calculated share per student</div>
              <div class="mt-1 text-xl font-extrabold text-emerald-700">₱{{ formatMoney(splitResult.totalUtilityShare) }}</div>
              <div class="mt-0.5 text-[11px] text-emerald-700">
                Electricity: ₱{{ formatMoney(splitResult.electricShare) }} + Water: ₱{{ formatMoney(splitResult.waterShare) }}
              </div>
            </div>
            <p v-if="splitError" role="alert" class="text-red-700">{{ splitError }}</p>
          </div>
        </section>

        <section class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div class="flex items-center justify-between border-b pb-2">
            <div class="flex items-center space-x-2 text-sm font-bold text-slate-800">
              <CreditCard class="h-4 w-4 text-emerald-600" />
              <span>Record a Payment</span>
            </div>
            <span class="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
              {{ networkStore.isOnline ? 'Online mode' : 'Offline queue active' }}
            </span>
          </div>

          <div v-if="paymentFeedback" role="status" class="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <span>{{ paymentFeedback }}</span>
            <button @click="paymentFeedback = null" class="ml-2 font-bold underline">Dismiss</button>
          </div>
          <div v-if="paymentError" role="alert" class="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            {{ paymentError }}
          </div>

          <div class="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <label class="font-medium text-slate-600">
              <span class="mb-1 block">Invoice</span>
              <select v-model="selectedInvoiceId" class="w-full rounded border border-slate-300 bg-white px-3 py-1.5">
                <option value="">Select an invoice</option>
                <option v-for="invoice in billingStore.invoices" :key="invoice.id" :value="invoice.id">
                  {{ invoice.invoiceNumber }} — ₱{{ formatMoney(outstandingBalance(invoice)) }} due
                </option>
              </select>
            </label>
            <label class="font-medium text-slate-600">
              <span class="mb-1 block">Payment amount (₱)</span>
              <input v-model.number="paymentAmount" type="number" min="0.01" :max="selectedBalance" step="0.01" class="w-full rounded border border-slate-300 px-3 py-1.5" />
              <span v-if="selectedInvoice" class="mt-1 block text-[11px] text-slate-500">Outstanding: ₱{{ formatMoney(selectedBalance) }}</span>
            </label>
            <label class="font-medium text-slate-600">
              <span class="mb-1 block">Method</span>
              <select v-model="paymentMethod" class="w-full rounded border border-slate-300 bg-white px-3 py-1.5">
                <option value="cash">Cash (on-site)</option>
                <option value="gcash">GCash</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </label>
          </div>
          <button
            @click="handlePayment"
            :disabled="!selectedInvoice || selectedBalance <= 0"
            class="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Record payment
          </button>
        </section>
      </div>

      <InvoiceLedger />
    </div>
  </AppLayout>
</template>
