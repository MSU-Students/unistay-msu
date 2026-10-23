import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import InvoiceLedger from './InvoiceLedger.vue';
import { useBillingStore } from '../../stores/billing';
import { Invoice } from '../../types';

describe('InvoiceLedger payment anomalies', () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    setActivePinia(createPinia());
    const billingStore = useBillingStore();
    billingStore.unassignedPayments = [];
    billingStore.invoices = [
      makeInvoice('invoice-anomaly', [{
        id: 'payment-anomaly',
        amount: 300,
        paymentMethod: 'gcash',
        paymentDate: '2026-10-01T10:00:00.000Z',
        isSynced: true,
        is_anomaly: true,
        anomaly_details: {
          type: 'DUPLICATE_TRANSACTION',
          severity: 'MEDIUM',
          reason: 'Possible repeated charge within 10 minutes.',
        },
      }]),
      makeInvoice('invoice-normal', [{
        id: 'payment-normal',
        amount: 400,
        paymentMethod: 'cash',
        paymentDate: '2026-10-02T10:00:00.000Z',
        isSynced: true,
        is_anomaly: false,
        anomaly_details: null,
      }]),
    ];
    wrapper = mount(InvoiceLedger);
  });

  afterEach(() => wrapper.unmount());

  it('highlights anomalous invoice rows and shows a reason tooltip on the warning badge', () => {
    const anomalousRow = wrapper.findAll('tbody tr').find((row) =>
      row.text().includes('invoice-anomaly'),
    );
    expect(anomalousRow?.classes()).toContain('border-amber-500');

    const badge = wrapper.get('[aria-label^="Payment anomaly:"]');
    expect(badge.text()).toContain('MEDIUM anomaly');
    expect(badge.attributes('title')).toBe(
      'DUPLICATE_TRANSACTION: Possible repeated charge within 10 minutes.',
    );
    expect(wrapper.findAll('[aria-label^="Payment anomaly:"]')).toHaveLength(1);
  });

  it('filters the ledger down to anomalous invoices and their flagged payments', async () => {
    await wrapper.get('button[aria-pressed]').trigger('click');

    expect(wrapper.get('button[aria-pressed]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.get('tbody tr').text()).toContain('invoice-anomaly');
    expect(wrapper.get('tbody tr').text()).not.toContain('invoice-normal');
    expect(wrapper.findAll('[aria-label^="Payment anomaly:"]')).toHaveLength(1);
  });

  it('renders unassigned payments with the reason tooltip and includes them in anomaly counts', async () => {
    useBillingStore().unassignedPayments = [{
      id: 'unassigned-payment',
      amount: 125,
      paymentMethod: 'bank_transfer',
      paymentDate: '2026-10-03T10:00:00.000Z',
      isSynced: true,
      is_anomaly: true,
      anomaly_details: {
        type: 'UNLINKED_PAYMENT',
        severity: 'HIGH',
        reason: 'Payment is not associated with an invoice.',
      },
    }];
    await nextTick();

    const panel = wrapper.get('[aria-label="Unassigned payments requiring review"]');
    expect(panel.text()).toContain('No linked invoice');
    expect(panel.get('[aria-label^="Payment anomaly:"]').attributes('title')).toBe(
      'UNLINKED_PAYMENT: Payment is not associated with an invoice.',
    );
    expect(wrapper.get('button[aria-pressed]').text()).toContain('(2)');
  });
});

function makeInvoice(id: string, payments: Invoice['payments']): Invoice {
  return {
    id,
    invoiceNumber: id,
    tenant: {
      id: 'tenant-1',
      email: 'tenant@example.edu',
      fullName: 'Test Tenant',
      role: 'student',
    },
    property: {
      id: 'property-1',
      name: 'Test Property',
      type: 'institutional_dorm',
      description: '',
      address: '',
      minMonthlyRate: 1000,
      maxMonthlyRate: 1000,
      isAccredited: true,
    },
    rentAmount: 1000,
    electricityAmount: 0,
    waterAmount: 0,
    otherFees: 0,
    totalAmount: 1000,
    paidAmount: 0,
    status: 'unpaid',
    dueDate: '2026-10-15',
    payments,
    createdAt: '2026-10-01T10:00:00.000Z',
  };
}
