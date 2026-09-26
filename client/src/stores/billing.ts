import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Invoice } from '../types';
import apiClient from '../api/client';
import { db } from '../db';
import { syncEngine } from '../db/sync-engine';

export const useBillingStore = defineStore('billing', () => {
  const invoices = ref<Invoice[]>([]);
  const loading = ref<boolean>(false);

  async function fetchInvoices() {
    loading.value = true;
    try {
      const res = await apiClient.get('/billing/invoices');
      invoices.value = res.data.data;
      await db.invoices.clear();
      await db.invoices.bulkPut(invoices.value);
    } catch (err) {
      console.warn('[BillingStore] Loading cached invoices from Dexie...');
      invoices.value = await db.invoices.toArray();
    } finally {
      loading.value = false;
    }
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
        // Fallback to queue if request failed
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
      await db.invoices.put(inv);
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
    fetchInvoices,
    recordPayment,
    calculateUtilitySplit,
  };
});
