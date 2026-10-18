import type { Invoice, Payment, PaymentAnomalyDetails } from './entities/invoice.entity';
import type { Lease } from '../housing/entities/application.entity';

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

interface PaymentRecord {
  invoice: Invoice;
  payment: Payment;
}

function amountInCents(amount: number | string): number {
  return Math.round(Number(amount) * 100);
}

function paymentTimestamp(payment: Payment): number {
  return new Date(payment.paymentDate || payment.createdAt).getTime();
}

function setAnomaly(payment: Payment, details: PaymentAnomalyDetails): void {
  const priority: Record<PaymentAnomalyDetails['type'], number> = {
    UNLINKED_PAYMENT: 1,
    DUPLICATE_TRANSACTION: 2,
    OVERPAYMENT: 3,
  };

  if (
    !payment.anomaly_details ||
    priority[details.type] > priority[payment.anomaly_details.type]
  ) {
    payment.is_anomaly = true;
    payment.anomaly_details = details;
  }
}

export function detectPaymentAnomalies(
  invoices: Invoice[],
  activeLeases?: Lease[],
): Invoice[] {
  const duplicateGroups = new Map<string, PaymentRecord[]>();
  const activeLeaseKeys = activeLeases
    ? new Set(
        activeLeases.map((lease) =>
          JSON.stringify([lease.tenant?.id, lease.unit?.property?.id, lease.unit?.id]),
        ),
      )
    : undefined;

  for (const invoice of invoices) {
    const payments = invoice.payments || [];
    for (const payment of payments) {
      payment.is_anomaly = false;
      payment.anomaly_details = null;

      if (!invoice.tenant?.id || !invoice.property?.id) {
        setAnomaly(payment, {
          type: 'UNLINKED_PAYMENT',
          severity: 'HIGH',
          reason: 'Payment is missing an assigned tenant or property.',
        });
      } else if (
        activeLeaseKeys &&
        !activeLeaseKeys.has(
          JSON.stringify([invoice.tenant.id, invoice.property.id, invoice.unit?.id]),
        )
      ) {
        setAnomaly(payment, {
          type: 'UNLINKED_PAYMENT',
          severity: 'HIGH',
          reason: 'Invoice has no matching active lease for this tenant, unit, and property.',
        });
      }

      if (invoice.tenant?.id && invoice.property?.id) {
        const amount = amountInCents(payment.amount);
        const key = JSON.stringify([invoice.tenant.id, invoice.property.id, amount]);
        const group = duplicateGroups.get(key) || [];
        group.push({ invoice, payment });
        duplicateGroups.set(key, group);
      }
    }

    const invoiceTotalCents = amountInCents(invoice.totalAmount);
    const paidCents = payments.reduce(
      (total, payment) => total + amountInCents(payment.amount),
      0,
    );
    if (payments.length > 0 && paidCents > invoiceTotalCents) {
      const paidAmount = (paidCents / 100).toFixed(2);
      const invoiceAmount = (invoiceTotalCents / 100).toFixed(2);
      for (const payment of payments) {
        setAnomaly(payment, {
          type: 'OVERPAYMENT',
          severity: 'HIGH',
          reason: `Recorded payments total ${paidAmount}, exceeding the invoice charge of ${invoiceAmount}.`,
        });
      }
    }
  }

  for (const group of duplicateGroups.values()) {
    const validRecords = group
      .map((record) => ({ ...record, timestamp: paymentTimestamp(record.payment) }))
      .filter((record) => Number.isFinite(record.timestamp))
      .sort((first, second) => first.timestamp - second.timestamp);

    for (let index = 0; index < validRecords.length; index += 1) {
      const current = validRecords[index];
      const neighbors = [validRecords[index - 1], validRecords[index + 1]]
        .filter((neighbor) => neighbor !== undefined)
        .map((neighbor) => ({
          record: neighbor,
          elapsed: Math.abs(current.timestamp - neighbor.timestamp),
        }))
        .filter((neighbor) => neighbor.elapsed < DUPLICATE_WINDOW_MS)
        .sort((first, second) => first.elapsed - second.elapsed);
      const duplicate = neighbors[0];
      if (!duplicate) continue;

      const elapsedMinutes = Math.floor(duplicate.elapsed / (60 * 1000));
      const interval = elapsedMinutes === 0
        ? 'less than 1 minute'
        : `${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'}`;
      const reason = `Identical payment amounts were recorded for the same tenant and property within ${interval}.`;
      setAnomaly(current.payment, {
        type: 'DUPLICATE_TRANSACTION',
        severity: 'MEDIUM',
        reason,
      });
      setAnomaly(duplicate.record.payment, {
        type: 'DUPLICATE_TRANSACTION',
        severity: 'MEDIUM',
        reason,
      });
    }
  }

  return invoices;
}

export function flagUnassignedPayments(payments: Payment[]): Payment[] {
  return payments.map((payment) => {
    payment.is_anomaly = true;
    payment.anomaly_details = {
      type: 'UNLINKED_PAYMENT',
      severity: 'HIGH',
      reason: 'Payment is not associated with an invoice.',
    };
    return payment;
  });
}
