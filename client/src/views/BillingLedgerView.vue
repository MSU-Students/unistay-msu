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
  Receipt,
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

const canCreateInvoices = computed(
  () =>
    authStore.user?.role === 'property_manager' ||
    authStore.user?.role === 'university_admin',
);
const selectedPropertyId = ref('');
const selectedTenantId = ref('');
const selectedUnitId = ref('');
const rentAmount = ref<number | null>(null);
const electricityAmount = ref(0);
const waterAmount = ref(0);
const otherFees = ref(0);
const dueDate = ref('');
const utilitySplitNotes = ref('');
const creatingInvoice = ref(false);
const loadingInvoiceOptions = ref(false);
const invoiceFormError = ref<string | null>(null);
const invoiceFormSuccess = ref<string | null>(null);
const invoiceOptionsError = ref<string | null>(null);
const selectedTenantOption = computed(() =>
  billingStore.invoiceTenants.find(
    (option) => option.tenant.id === selectedTenantId.value,
  ),
);
const eligibleUnits = computed(() => selectedTenantOption.value?.units ?? []);
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

  if (canCreateInvoices.value) {
    loadingInvoiceOptions.value = true;
    billingStore
      .fetchInvoiceProperties()
      .catch((error: unknown) => {
        invoiceOptionsError.value = requestErrorMessage(
          error,
          'Unable to load properties for invoice creation.',
        );
      })
      .finally(() => {
        loadingInvoiceOptions.value = false;
      });
  if (authStore.isAdmin) {
    void housingStore.fetchProperties();
    void fetchFinanceSummary();
  }
});

watch(selectedInvoiceId, () => {
  paymentAmount.value = selectedBalance.value;
});

function requestErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return fallback;
  }
  const response = (
    error as { response?: { data?: { message?: string | string[] } } }
  ).response;
  const message = response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : message || fallback;
}

async function loadEligibleTenants() {
  selectedTenantId.value = '';
  selectedUnitId.value = '';
  rentAmount.value = null;
  billingStore.invoiceTenants = [];
  invoiceOptionsError.value = null;
  if (!selectedPropertyId.value) return;

  loadingInvoiceOptions.value = true;
  try {
    await billingStore.fetchInvoiceTenants(selectedPropertyId.value);
  } catch (error) {
    invoiceOptionsError.value = requestErrorMessage(
      error,
      'Unable to load eligible tenants for this property.',
    );
  } finally {
    loadingInvoiceOptions.value = false;
  }
}

function updateRentFromUnit() {
  const unit = eligibleUnits.value.find(
    (eligibleUnit) => eligibleUnit.id === selectedUnitId.value,
  );
  rentAmount.value = unit?.monthlyRate ?? null;
}

async function submitInvoice() {
  invoiceFormError.value = null;
  invoiceFormSuccess.value = null;
  const amounts = [
    rentAmount.value,
    electricityAmount.value,
    waterAmount.value,
    otherFees.value,
  ];

  if (!selectedPropertyId.value || !selectedTenantId.value || !dueDate.value) {
    invoiceFormError.value =
      'Select a property and tenant, and enter a due date.';
    return;
  }
  if (
    amounts.some(
      (amount) =>
        amount === null ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > 99999999.99 ||
        !/^\d+(\.\d{1,2})?$/.test(String(amount)),
    )
  ) {
    invoiceFormError.value =
      'Enter valid, nonnegative charge amounts with no more than two decimal places.';
    return;
  }

  creatingInvoice.value = true;
  try {
    await billingStore.createInvoice({
      tenantId: selectedTenantId.value,
      propertyId: selectedPropertyId.value,
      ...(selectedUnitId.value ? { unitId: selectedUnitId.value } : {}),
      rentAmount: rentAmount.value as number,
      electricityAmount: electricityAmount.value,
      waterAmount: waterAmount.value,
      otherFees: otherFees.value,
      dueDate: dueDate.value,
      utilitySplitNotes: utilitySplitNotes.value || undefined,
    });
    invoiceFormSuccess.value = 'Invoice created successfully.';
    selectedTenantId.value = '';
    selectedUnitId.value = '';
    rentAmount.value = null;
    electricityAmount.value = 0;
    waterAmount.value = 0;
    otherFees.value = 0;
    dueDate.value = '';
    utilitySplitNotes.value = '';
  } catch (error) {
    invoiceFormError.value = requestErrorMessage(
      error,
      'Unable to create the invoice. Please try again.',
    );
  } finally {
    creatingInvoice.value = false;
  }
}

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


      <section
        v-if="canCreateInvoices"
        class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4"
      >
        <div class="flex items-center space-x-2 text-slate-800 font-bold text-sm border-b pb-2">
          <Receipt class="w-4 h-4 text-msu-maroon" />
          <h2>Create monthly rent invoice</h2>
        </div>

        <p class="text-xs text-slate-600">
          Select a property and an active tenant. The optional unit is limited to the tenant's active leases there.
        </p>

        <div
          v-if="invoiceFormSuccess"
          role="status"
          class="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg"
        >
          {{ invoiceFormSuccess }}
        </div>
        <div
          v-if="invoiceFormError || invoiceOptionsError"
          role="alert"
          class="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg"
        >
          {{ invoiceFormError || invoiceOptionsError }}
        </div>

        <form class="space-y-4" @submit.prevent="submitInvoice">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label for="invoice-property" class="font-medium text-slate-600 block mb-1">
                Property
              </label>
              <select
                id="invoice-property"
                v-model="selectedPropertyId"
                required
                :disabled="loadingInvoiceOptions || creatingInvoice"
                class="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-msu-maroon"
                @change="loadEligibleTenants"
              >
                <option value="" disabled>Select a property</option>
                <option
                  v-for="property in billingStore.invoiceProperties"
                  :key="property.id"
                  :value="property.id"
                >
                  {{ property.name }}
                </option>
              </select>
            </div>

            <div>
              <label for="invoice-tenant" class="font-medium text-slate-600 block mb-1">
                Active tenant
              </label>
              <select
                id="invoice-tenant"
                v-model="selectedTenantId"
                required
                :disabled="!selectedPropertyId || loadingInvoiceOptions || creatingInvoice"
                class="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-msu-maroon"
                @change="selectedUnitId = ''; rentAmount = null"
              >
                <option value="" disabled>Select a tenant</option>
                <option
                  v-for="option in billingStore.invoiceTenants"
                  :key="option.tenant.id"
                  :value="option.tenant.id"
                >
                  {{ option.tenant.fullName }}
                </option>
              </select>
              <p
                v-if="selectedPropertyId && !loadingInvoiceOptions && billingStore.invoiceTenants.length === 0"
                class="mt-1 text-[11px] text-slate-500"
              >
                No tenants with active leases were found for this property.
              </p>
            </div>

            <div>
              <label for="invoice-unit" class="font-medium text-slate-600 block mb-1">
                Unit (optional)
              </label>
              <select
                id="invoice-unit"
                v-model="selectedUnitId"
                :disabled="!selectedTenantId || creatingInvoice"
                class="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-msu-maroon"
                @change="updateRentFromUnit"
              >
                <option value="">No unit specified</option>
                <option
                  v-for="unit in eligibleUnits"
                  :key="unit.id"
                  :value="unit.id"
                >
                  {{ unit.roomNumber }} — ₱{{ unit.monthlyRate }}/month
                </option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            <div>
              <label for="invoice-rent" class="font-medium text-slate-600 block mb-1">
                Monthly rent (₱)
              </label>
              <input
                id="invoice-rent"
                v-model.number="rentAmount"
                type="number"
                min="0"
                step="0.01"
                required
                class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-msu-maroon"
              />
            </div>
            <div>
              <label for="invoice-electricity" class="font-medium text-slate-600 block mb-1">
                Electricity (₱)
              </label>
              <input
                id="invoice-electricity"
                v-model.number="electricityAmount"
                type="number"
                min="0"
                step="0.01"
                class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-msu-maroon"
              />
            </div>
            <div>
              <label for="invoice-water" class="font-medium text-slate-600 block mb-1">
                Water (₱)
              </label>
              <input
                id="invoice-water"
                v-model.number="waterAmount"
                type="number"
                min="0"
                step="0.01"
                class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-msu-maroon"
              />
            </div>
            <div>
              <label for="invoice-other-fees" class="font-medium text-slate-600 block mb-1">
                Other charges (₱)
              </label>
              <input
                id="invoice-other-fees"
                v-model.number="otherFees"
                type="number"
                min="0"
                step="0.01"
                class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-msu-maroon"
              />
            </div>
            <div>
              <label for="invoice-due-date" class="font-medium text-slate-600 block mb-1">
                Due date
              </label>
              <input
                id="invoice-due-date"
                v-model="dueDate"
                type="date"
                required
                class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-msu-maroon"
              />
            </div>
          </div>

          <div>
            <label for="invoice-utility-notes" class="font-medium text-slate-600 block mb-1 text-xs">
              Utility split notes (optional)
            </label>
            <input
              id="invoice-utility-notes"
              v-model="utilitySplitNotes"
              type="text"
              class="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-msu-maroon"
            />
          </div>

          <button
            type="submit"
            :disabled="creatingInvoice || loadingInvoiceOptions || !billingStore.invoiceProperties.length"
            class="bg-msu-maroon hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
          >
            {{ creatingInvoice ? 'Creating invoice...' : 'Create invoice' }}
          </button>
        </form>
      </section>

          <div class="grid grid-cols-1 gap-6 lg:grid-cols-3 print-hidden">
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
