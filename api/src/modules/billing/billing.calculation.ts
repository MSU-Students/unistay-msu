import { BadRequestException } from '@nestjs/common';
import { InvoiceItem } from './entities/invoice.entity';

export function calculateInvoiceTotals(
  items: Array<Pick<InvoiceItem, 'amount'>>,
  taxAmount: number,
): { subtotal: number; tax: number; totalAmount: number } {
  const amounts = items.map((item) => Number(item.amount));
  const tax = Number(taxAmount);
  if (
    amounts.some((amount) => !Number.isFinite(amount) || amount <= 0 || amount > 99999999.99)
    || !Number.isFinite(tax)
    || tax < 0
    || tax > 99999999.99
  ) {
    throw new BadRequestException('Invoice line items and tax must contain valid non-negative amounts');
  }
  const subtotal = Math.round(amounts.reduce((sum, amount) => sum + amount, 0) * 100) / 100;
  const totalAmount = Math.round((subtotal + tax) * 100) / 100;
  if (totalAmount > 99999999.99) {
    throw new BadRequestException('Invoice total exceeds the supported amount');
  }
  return { subtotal, tax, totalAmount };
}
