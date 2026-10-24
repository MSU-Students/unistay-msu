import { defineStore } from 'pinia';
import { ref, toRaw } from 'vue';
import { isAxiosError } from 'axios';
import { FinanceSummary, FinanceSummaryQuery, Invoice, Payment } from '../types';
import apiClient from '../api/client';
import { db } from '../db';
import { syncEngine } from '../db/sync-engine';

export const useBillingStore = defineStore('billing', () => {
  const invoices = ref<Invoice[]>([]);
  const loading = ref<boolean>(false);
  const loadError = ref<string | null>(null);

  async function fetchInvoices() {
    loading.value = true;
    loadError.value = null;
    try {
      const res = await apiClient.get('/billing/invoices');
      const latestInvoices: Invoice[] = res.data.data;
      invoices.value = latestInvoices;
      try {
        await db.invoices.clear();
        await db.invoices.bulkPut(latestInvoices);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown storage error';
        console.warn('[BillingStore] Could not cache the latest invoices locally.', message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown request error';
      console.warn('[BillingStore] Could not fetch invoices; loading cached records.', message);
      invoices.value = await db.invoices.toArray();
      if (invoices.value.length === 0) {
        loadError.value = 'Could not reach the billing service and no cached records are available.';
      }
    } finally {
      loading.value = false;
    }
  }

  async function fetchFinanceSummary(filters: FinanceSummaryQuery) {
    const res = await apiClient.get('/billing/admin/summary', { params: filters });
    return res.data.data as FinanceSummary;
  }

  async function recordPayment(invoiceId: string, amount: number, paymentMethod: 'cash' | 'gcash' | 'bank_transfer') {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const payload = {
      invoiceId,
      amount,
      paymentMethod,
      offlineReferenceId: `OFFLINE_PAY_${Date.now()}`,
    };

    if (isOnline) {
      try {
        const res = await apiClient.post('/billing/payments', payload);
        await fetchInvoices();
        return { online: true, data: res.data.data };
      } catch (err) {
        if (!isAxiosError(err) || err.response) {
          throw err;
        }
      }
    }

    // Offline mode: Enqueue to Dexie
    const mutationId = await syncEngine.enqueueMutation('CREATE_PAYMENT', payload);

    // Optimistically update invoice in local store and Dexie
    const inv = invoices.value.find((i) => i.id === invoiceId);
    if (inv) {
      inv.paidAmount = Number(inv.paidAmount) + Number(amount);
      if (inv.paidAmount >= inv.totalAmount) {
        inv.status = 'paid';
      } else {
        inv.status = 'partially_paid';
      }
      const optimisticPayment: Payment = {
        id: payload.offlineReferenceId,
        amount,
        paymentMethod,
        paymentDate: new Date().toISOString(),
        offlineReferenceId: payload.offlineReferenceId,
        isSynced: false,
      };
      inv.payments = [optimisticPayment, ...(inv.payments || [])];
      await db.invoices.put(toRaw(inv));
    }

    return {
      online: false,
      mutationId,
      message: 'Payment recorded offline in Dexie.js queue. Will synchronize automatically upon reconnection.',
    };
  }

  async function calculateUtilitySplit(totalElectricBill: number, totalWaterBill: number, occupantCount: number) {
    const res = await apiClient.post('/billing/utility-splitter/calculate', {
      totalElectricBill,
      totalWaterBill,
      occupantCount,
    });
    return res.data.data;
  }

  return {
    invoices,
    loading,
    loadError,
    fetchInvoices,
    fetchFinanceSummary,
    recordPayment,
    calculateUtilitySplit,
  };
});
