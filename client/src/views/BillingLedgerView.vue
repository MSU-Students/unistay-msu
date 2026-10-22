<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import { useBillingStore } from '../stores/billing';
import { useNetworkStore } from '../stores/network';
import { useAuthStore } from '../stores/auth';
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

onMounted(() => {
  billingStore.fetchInvoices();
  calculateSplit();
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
  }
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
</script>

<template>
  <AppLayout>
    <div class="space-y-8">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Billing Ledger & Utility Splitting</h1>
        <p class="text-xs text-slate-600">Transparent billing history, shared meter calculation, and offline-resilient payment logging.</p>
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

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th class="px-5 py-3">Invoice #</th>
                <th class="px-5 py-3">Rent</th>
                <th class="px-5 py-3">Electricity</th>
                <th class="px-5 py-3">Water</th>
                <th class="px-5 py-3">Total</th>
                <th class="px-5 py-3">Status</th>
                <th class="px-5 py-3">Due Date</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="billingStore.invoices.length === 0">
                <td colspan="7" class="px-5 py-8 text-center text-slate-400">
                  No billing records found.
                </td>
              </tr>
              <tr v-for="inv in billingStore.invoices" :key="inv.id" class="hover:bg-slate-50">
                <td class="px-5 py-3 font-semibold text-slate-800">{{ inv.invoiceNumber }}</td>
                <td class="px-5 py-3">₱{{ inv.rentAmount }}</td>
                <td class="px-5 py-3">₱{{ inv.electricityAmount }}</td>
                <td class="px-5 py-3">₱{{ inv.waterAmount }}</td>
                <td class="px-5 py-3 font-bold text-slate-900">₱{{ inv.totalAmount }}</td>
                <td class="px-5 py-3">
                  <span
                    :class="[
                      inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                      inv.status === 'partially_paid' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800',
                      'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider'
                    ]"
                  >
                    {{ inv.status.replace('_', ' ') }}
                  </span>
                </td>
                <td class="px-5 py-3 text-slate-500">{{ inv.dueDate }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
