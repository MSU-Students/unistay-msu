<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { CheckCircle2, Clock, Download, Printer } from 'lucide-vue-next';
import { useBillingStore } from '../../stores/billing';
import { Invoice, Payment } from '../../types';

const billingStore = useBillingStore();
const printingInvoiceId = ref<string | null>(null);

const csvHeaders = [
  'Invoice number',
  'Property',
  'Unit',
  'Rent',
  'Electricity',
  'Water',
  'Other fees',
  'Total charges',
  'Total paid',
  'Outstanding balance',
  'Invoice status',
  'Due date',
  'Payment date',
  'Payment amount',
  'Payment method',
  'Payment status',
  'Receipt',
];

function formatMoney(value: number | string) {
  return Number(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getOutstandingBalance(invoice: Invoice) {
  return Math.max(0, Number(invoice.totalAmount) - Number(invoice.paidAmount));
}

function getStatusClass(status: Invoice['status']) {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-800';
  if (status === 'partially_paid') return 'bg-amber-100 text-amber-800';
  if (status === 'overdue') return 'bg-red-100 text-red-800';
  return 'bg-slate-100 text-slate-700';
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? '');
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function invoiceToCsvRows(invoice: Invoice) {
  const payments: Array<Payment | undefined> = invoice.payments?.length
    ? invoice.payments
    : [undefined];

  return payments.map((payment) => [
    invoice.invoiceNumber,
    invoice.property?.name,
    invoice.unit?.roomNumber,
    invoice.rentAmount,
    invoice.electricityAmount,
    invoice.waterAmount,
    invoice.otherFees,
    invoice.totalAmount,
    invoice.paidAmount,
    getOutstandingBalance(invoice),
    invoice.status.replace('_', ' '),
    formatDate(invoice.dueDate),
    payment ? formatDate(payment.paymentDate) : '',
    payment?.amount,
    payment?.paymentMethod?.replace('_', ' '),
    payment ? (payment.isSynced ? 'Confirmed' : 'Awaiting sync') : '',
    payment?.receiptUrl,
  ]);
}

function downloadCsv(invoices: Invoice[], filename: string) {
  const rows = invoices.flatMap(invoiceToCsvRows);
  const csv = [csvHeaders, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadLedger() {
  downloadCsv(billingStore.invoices, 'unistay-rent-payment-ledger.csv');
}

function downloadInvoice(invoice: Invoice) {
  const safeInvoiceNumber = invoice.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '-');
  downloadCsv([invoice], `unistay-invoice-${safeInvoiceNumber}.csv`);
}

function printLedger() {
  window.print();
}

async function printInvoice(invoiceId: string) {
  printingInvoiceId.value = invoiceId;
  await nextTick();
  window.addEventListener(
    'afterprint',
    () => {
      printingInvoiceId.value = null;
    },
    { once: true },
  );
  window.print();
}
</script>

<template>
  <section id="rent-ledger" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
      <div>
        <h2 class="text-sm font-bold text-slate-800">Monthly Invoices & Payment Ledger</h2>
        <p class="mt-1 text-xs text-slate-500">Paid and outstanding balances with recorded payment details.</p>
      </div>
      <div class="print-hidden flex gap-2">
        <button
          @click="downloadLedger"
          :disabled="billingStore.invoices.length === 0"
          class="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Download class="h-3.5 w-3.5" />Download CSV
        </button>
        <button
          @click="printLedger"
          :disabled="billingStore.invoices.length === 0"
          class="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Printer class="h-3.5 w-3.5" />Print
        </button>
      </div>
    </div>

    <div
      v-if="billingStore.loadError"
      role="alert"
      class="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-800"
    >
      {{ billingStore.loadError }}
    </div>

    <div class="overflow-x-auto">
      <table class="w-full min-w-[1180px] text-left text-xs">
        <thead class="border-b border-slate-200 bg-slate-50 uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-3">Invoice / Unit</th>
            <th class="px-4 py-3">Monthly charges</th>
            <th class="px-4 py-3">Total</th>
            <th class="px-4 py-3">Paid</th>
            <th class="px-4 py-3">Outstanding</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Due date</th>
            <th class="px-4 py-3">Payment history</th>
            <th class="print-hidden px-4 py-3">Invoice actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="billingStore.loading">
            <td colspan="9" class="px-5 py-8 text-center text-slate-500">Loading billing records…</td>
          </tr>
          <tr v-else-if="billingStore.invoices.length === 0">
            <td colspan="9" class="px-5 py-8 text-center text-slate-400">No billing records found.</td>
          </tr>
          <template v-else>
            <tr
              v-for="invoice in billingStore.invoices"
              :key="invoice.id"
              :class="[
                'align-top hover:bg-slate-50',
                printingInvoiceId && printingInvoiceId !== invoice.id ? 'invoice-row-print-hidden' : '',
              ]"
            >
              <td class="px-4 py-3">
                <div class="font-semibold text-slate-800">{{ invoice.invoiceNumber }}</div>
                <div class="mt-1 text-slate-500">{{ invoice.property?.name || 'Property' }}</div>
                <div class="text-slate-500">Unit {{ invoice.unit?.roomNumber || '—' }}</div>
              </td>
              <td class="px-4 py-3 text-slate-600">
                <div>Rent: ₱{{ formatMoney(invoice.rentAmount) }}</div>
                <div>Electricity: ₱{{ formatMoney(invoice.electricityAmount) }}</div>
                <div>Water: ₱{{ formatMoney(invoice.waterAmount) }}</div>
                <div>Other: ₱{{ formatMoney(invoice.otherFees) }}</div>
              </td>
              <td class="whitespace-nowrap px-4 py-3 font-bold text-slate-900">
                ₱{{ formatMoney(invoice.totalAmount) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-emerald-700">
                ₱{{ formatMoney(invoice.paidAmount) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                ₱{{ formatMoney(getOutstandingBalance(invoice)) }}
              </td>
              <td class="px-4 py-3">
                <span
                  :class="[
                    getStatusClass(invoice.status),
                    'whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  ]"
                >
                  {{ invoice.status.replace('_', ' ') }}
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-slate-500">
                {{ formatDate(invoice.dueDate) }}
              </td>
              <td class="px-4 py-3">
                <ul v-if="invoice.payments?.length" class="space-y-2">
                  <li
                    v-for="payment in invoice.payments"
                    :key="payment.id"
                    class="min-w-44 border-b border-slate-100 pb-2 last:border-0"
                  >
                    <div class="flex items-center gap-1.5 font-semibold text-slate-700">
                      <CheckCircle2 v-if="payment.isSynced" class="h-3.5 w-3.5 text-emerald-600" />
                      <Clock v-else class="h-3.5 w-3.5 text-amber-600" />
                      ₱{{ formatMoney(payment.amount) }} · {{ formatDate(payment.paymentDate) }}
                    </div>
                    <div class="mt-0.5 text-slate-500">
                      {{ payment.paymentMethod.replace('_', ' ') }} ·
                      {{ payment.isSynced ? 'Confirmed' : 'Awaiting sync' }}
                    </div>
                    <a
                      v-if="payment.receiptUrl"
                      :href="payment.receiptUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="mt-0.5 inline-block text-msu-maroon underline"
                    >
                      View receipt
                    </a>
                  </li>
                </ul>
                <span v-else class="text-slate-400">No payments recorded</span>
              </td>
              <td class="print-hidden px-4 py-3">
                <div class="flex flex-col items-start gap-2">
                  <button
                    type="button"
                    @click="downloadInvoice(invoice)"
                    class="inline-flex items-center gap-1 text-left font-semibold text-msu-maroon hover:underline"
                  >
                    <Download class="h-3.5 w-3.5" />
                    Download invoice
                  </button>
                  <button
                    type="button"
                    @click="printInvoice(invoice.id)"
                    class="inline-flex items-center gap-1 text-left font-semibold text-slate-700 hover:underline"
                  >
                    <Printer class="h-3.5 w-3.5" />
                    Print invoice
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style>
@media print {
  body * {
    visibility: hidden !important;
  }

  #rent-ledger,
  #rent-ledger * {
    visibility: visible !important;
  }

  #rent-ledger {
    position: absolute;
    inset: 0;
    width: 100%;
    overflow: visible !important;
    border: 0 !important;
    box-shadow: none !important;
  }

  #rent-ledger .print-hidden,
  #rent-ledger .invoice-row-print-hidden {
    display: none !important;
  }

  #rent-ledger table {
    min-width: 0 !important;
    font-size: 9pt;
  }
}
</style>
