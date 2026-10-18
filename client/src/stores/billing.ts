import { defineStore } from 'pinia';
import { ref, toRaw } from 'vue';
import { isAxiosError } from 'axios';
import { Invoice, Payment } from '../types';
import apiClient from '../api/client';
import { db } from '../db';
import { syncEngine } from '../db/sync-engine';
import { useAuthStore } from './auth';

export const useBillingStore = defineStore('billing', () => {
  const authStore = useAuthStore();
  const invoices = ref<Invoice[]>([]);
  const unassignedPayments = ref<Payment[]>([]);
  const unassignedPaymentsError = ref<string | null>(null);
  const loading = ref<boolean>(false);
  const loadError = ref<string | null>(null);

  function canReviewUnassignedPayments() {
    return authStore.user?.role === 'property_manager' ||
      authStore.user?.role === 'university_admin';
  }

  async function fetchInvoices() {
    loading.value = true;
    loadError.value = null;
    unassignedPayments.value = [];
    unassignedPaymentsError.value = null;
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

      if (canReviewUnassignedPayments()) {
        try {
          const unassignedRes = await apiClient.get('/billing/payments/unassigned');
          unassignedPayments.value = unassignedRes.data.data;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown request error';
          unassignedPaymentsError.value =
            'Could not load unassigned payments for anomaly review.';
          console.warn('[BillingStore] Could not fetch unassigned payments.', message);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown request error';
      console.warn('[BillingStore] Could not fetch invoices; loading cached records.', message);
      if (canReviewUnassignedPayments()) {
        unassignedPaymentsError.value =
          'Could not load unassigned payments for anomaly review.';
      }
      invoices.value = await db.invoices.toArray();
      if (invoices.value.length === 0) {
        loadError.value = 'Could not reach the billing service and no cached records are available.';
      }
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
    unassignedPayments,
    unassignedPaymentsError,
    loading,
    loadError,
    fetchInvoices,
    recordPayment,
    calculateUtilitySplit,
  };
});
