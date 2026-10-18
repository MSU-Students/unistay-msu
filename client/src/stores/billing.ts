import { defineStore } from 'pinia';
import { ref } from 'vue';
import { BillingLeaseOption, Invoice, InvoiceAuditLog, InvoiceStatus } from '../types';
import apiClient from '../api/client';
import { db } from '../db';
import { syncEngine } from '../db/sync-engine';

export const useBillingStore = defineStore('billing', () => {
  const invoices = ref<Invoice[]>([]);
  const loading = ref<boolean>(false);
  const selectedInvoice = ref<Invoice | null>(null);
  const auditTrail = ref<InvoiceAuditLog[]>([]);
  const activeLeases = ref<BillingLeaseOption[]>([]);
  const pagination = ref({ page: 1, limit: 20, total: 0, pageCount: 1 });

  async function fetchInvoices(propertyId?: string, filters: Record<string, string | number> = {}) {
    loading.value = true;
    try {
      const res = propertyId
        ? await apiClient.get(`/properties/${propertyId}/invoices`, { params: filters })
        : await apiClient.get('/billing/invoices');
      invoices.value = propertyId ? res.data.data.items : res.data.data;
      pagination.value = propertyId
        ? {
          page: res.data.data.page,
          limit: res.data.data.limit,
          total: res.data.data.total,
          pageCount: res.data.data.pageCount,
        }
        : { page: 1, limit: invoices.value.length, total: invoices.value.length, pageCount: 1 };
      if (!propertyId) await db.invoices.clear();
      await db.invoices.bulkPut(invoices.value);
    } catch (err) {
      console.warn('[BillingStore] Loading cached invoices from Dexie...');
      invoices.value = await db.invoices.toArray();
    } finally {
      loading.value = false;
    }
  }

  async function generateInvoice(propertyId: string, payload: Record<string, unknown>) {
    const res = await apiClient.post(`/properties/${propertyId}/invoices/generate`, payload);
    selectedInvoice.value = res.data.data;
    await fetchInvoices(propertyId);
    return res.data.data as Invoice;
  }

  async function fetchPropertyLeases(propertyId: string) {
    const res = await apiClient.get(`/properties/${propertyId}/invoices/leases`);
    activeLeases.value = res.data.data;
    return activeLeases.value;
  }

  async function fetchInvoice(invoiceId: string) {
    const res = await apiClient.get(`/invoices/${invoiceId}`);
    selectedInvoice.value = res.data.data;
    return selectedInvoice.value;
  }

  async function fetchAuditTrail(invoiceId: string) {
    const res = await apiClient.get(`/invoices/${invoiceId}/audit-trail`);
    auditTrail.value = res.data.data;
    return auditTrail.value;
  }

  async function updateInvoiceStatus(invoiceId: string, status: InvoiceStatus, notes?: string) {
    const res = await apiClient.patch(`/invoices/${invoiceId}/status`, { status, notes });
    selectedInvoice.value = res.data.data;
    const invoiceIndex = invoices.value.findIndex((invoice) => invoice.id === invoiceId);
    if (invoiceIndex >= 0) invoices.value[invoiceIndex] = res.data.data;
    await db.invoices.put(res.data.data);
    return res.data.data as Invoice;
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
        inv.status = 'PAID';
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
    selectedInvoice,
    auditTrail,
    activeLeases,
    pagination,
    fetchInvoices,
    generateInvoice,
    fetchPropertyLeases,
    fetchInvoice,
    fetchAuditTrail,
    updateInvoiceStatus,
    recordPayment,
    calculateUtilitySplit,
  };
});
