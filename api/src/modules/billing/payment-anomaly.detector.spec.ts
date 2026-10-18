import { describe, expect, it } from 'vitest';
import type { Invoice, Payment } from './entities/invoice.entity';
import type { Lease } from '../housing/entities/application.entity';
import {
  detectPaymentAnomalies,
  flagUnassignedPayments,
} from './payment-anomaly.detector';

function makePayment(id: string, amount: number, paymentDate: string): Payment {
  return {
    id,
    amount,
    paymentDate: new Date(paymentDate),
    paymentMethod: 'cash',
    isSynced: true,
  } as Payment;
}

function makeInvoice(
  id: string,
  totalAmount: number,
  payments: Payment[],
  tenantId = 'tenant-1',
  propertyId = 'property-1',
): Invoice {
  return {
    id,
    totalAmount,
    paidAmount: 550,
    status: 'paid',
    tenant: tenantId ? { id: tenantId } as Invoice['tenant'] : null,
    property: propertyId ? { id: propertyId } as Invoice['property'] : null,
    unit: { id: 'unit-1', property: { id: propertyId } } as Invoice['unit'],
    payments,
  } as Invoice;
}

function makeLease(tenantId = 'tenant-1', propertyId = 'property-1'): Lease {
  return {
    tenant: { id: tenantId },
    unit: { id: 'unit-1', property: { id: propertyId } },
  } as Lease;
}

describe('detectPaymentAnomalies', () => {
  it('leaves a normal payment unflagged', () => {
    const [invoice] = detectPaymentAnomalies(
      [
        makeInvoice('invoice-1', 1000, [
          makePayment('payment-1', 500, '2026-10-01T10:00:00.000Z'),
        ]),
      ],
      [makeLease()],
    );

    expect(invoice.payments[0].is_anomaly).toBe(false);
    expect(invoice.payments[0].anomaly_details).toBeNull();
  });

  it('flags identical payments for the same tenant and property within 24 hours', () => {
    const invoices = [
      makeInvoice('invoice-1', 1000, [
        makePayment('payment-1', 300, '2026-10-01T10:00:00.000Z'),
      ]),
      makeInvoice('invoice-2', 1000, [
        makePayment('payment-2', 300, '2026-10-01T10:10:00.000Z'),
      ]),
    ];

    detectPaymentAnomalies(invoices, [makeLease()]);

    for (const invoice of invoices) {
      expect(invoice.payments[0].is_anomaly).toBe(true);
      expect(invoice.payments[0].anomaly_details).toMatchObject({
        type: 'DUPLICATE_TRANSACTION',
        severity: 'MEDIUM',
      });
      expect(invoice.payments[0].anomaly_details.reason).toContain('10 minutes');
    }
  });

  it('flags all payments when their combined amount exceeds the invoice charge', () => {
    const [invoice] = detectPaymentAnomalies(
      [
        makeInvoice('invoice-1', 500, [
          makePayment('payment-1', 300, '2026-10-01T10:00:00.000Z'),
          makePayment('payment-2', 250, '2026-10-03T10:00:00.000Z'),
        ]),
      ],
      [makeLease()],
    );

    expect(invoice.payments.every((payment) => payment.is_anomaly)).toBe(true);
    expect(invoice.payments[0].anomaly_details).toMatchObject({
      type: 'OVERPAYMENT',
      severity: 'HIGH',
      reason: expect.stringContaining('550.00'),
    });
    expect(invoice.totalAmount).toBe(500);
    expect(invoice.paidAmount).toBe(550);
    expect(invoice.status).toBe('paid');
  });

  it('flags a payment whose invoice is missing its tenant or property assignment', () => {
    const [invoice] = detectPaymentAnomalies([
      makeInvoice(
        'invoice-1',
        1000,
        [makePayment('payment-1', 100, '2026-10-01T10:00:00.000Z')],
        '',
        'property-1',
      ),
    ]);

    expect(invoice.payments[0].is_anomaly).toBe(true);
    expect(invoice.payments[0].anomaly_details).toMatchObject({
      type: 'UNLINKED_PAYMENT',
      severity: 'HIGH',
    });
  });

  it('flags a payment with no invoice association', () => {
    const [payment] = flagUnassignedPayments([
      makePayment('payment-1', 100, '2026-10-01T10:00:00.000Z'),
    ]);

    expect(payment.is_anomaly).toBe(true);
    expect(payment.anomaly_details).toMatchObject({
      type: 'UNLINKED_PAYMENT',
      severity: 'HIGH',
      reason: 'Payment is not associated with an invoice.',
    });
  });

  it('flags payments that do not match an active tenant/unit/property lease', () => {
    const [invoice] = detectPaymentAnomalies([
      makeInvoice('invoice-1', 1000, [
        makePayment('payment-1', 100, '2026-10-01T10:00:00.000Z'),
      ]),
    ], []);

    expect(invoice.payments[0].is_anomaly).toBe(true);
    expect(invoice.payments[0].anomaly_details).toMatchObject({
      type: 'UNLINKED_PAYMENT',
      severity: 'HIGH',
      reason: expect.stringContaining('no matching active lease'),
    });
  });

  it('does not flag matching payments for different tenants or outside the 24-hour window', () => {
    const invoices = [
      makeInvoice('invoice-1', 1000, [
        makePayment('payment-1', 300, '2026-10-01T10:00:00.000Z'),
      ]),
      makeInvoice(
        'invoice-2',
        1000,
        [makePayment('payment-2', 300, '2026-10-02T10:00:00.000Z')],
        'tenant-2',
      ),
      makeInvoice('invoice-3', 1000, [
        makePayment('payment-3', 300, '2026-10-02T10:00:00.001Z'),
      ]),
    ];

    detectPaymentAnomalies(invoices, [makeLease(), makeLease('tenant-2')]);

    expect(invoices.flatMap((invoice) => invoice.payments).every((payment) => !payment.is_anomaly))
      .toBe(true);
  });
});
