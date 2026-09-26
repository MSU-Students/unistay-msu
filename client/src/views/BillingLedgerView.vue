<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import { useBillingStore } from '../stores/billing';
import { useNetworkStore } from '../stores/network';
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
});

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
