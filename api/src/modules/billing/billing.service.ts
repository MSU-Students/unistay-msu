import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus, Payment } from './entities/invoice.entity';
import {
  CreateInvoiceDto,
  RecordPaymentDto,
  UpdateInvoiceDto,
} from './dto/billing.dto';
import { HousingService } from '../housing/housing.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly housingService: HousingService,
  ) {}

  async findAllInvoices(userId?: string): Promise<Invoice[]> {
    const qb = this.invoiceRepo.createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.tenant', 'tenant')
      .leftJoinAndSelect('invoice.property', 'property')
      .leftJoinAndSelect('invoice.unit', 'unit')
      .leftJoinAndSelect('invoice.payments', 'payments')
      .orderBy('invoice.dueDate', 'DESC')
      .addOrderBy('payments.paymentDate', 'DESC');

    if (userId) {
      qb.andWhere('tenant.id = :userId', { userId });
    }

    const invoices = await qb.getMany();
    return invoices.map((invoice) => this.refreshInvoiceStatus(invoice));
  }

  async findInvoiceById(id: string, tenantId?: string): Promise<Invoice> {
    const qb = this.invoiceRepo.createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.tenant', 'tenant')
      .leftJoinAndSelect('invoice.property', 'property')
      .leftJoinAndSelect('property.manager', 'propertyManager')
      .leftJoinAndSelect('invoice.unit', 'unit')
      .leftJoinAndSelect('invoice.payments', 'payments')
      .where('invoice.id = :id', { id })
      .orderBy('payments.paymentDate', 'DESC');

    if (tenantId) {
      qb.andWhere('tenant.id = :tenantId', { tenantId });
    }

    const invoice = await qb.getOne();
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    return this.refreshInvoiceStatus(invoice);
  }

  private refreshInvoiceStatus(invoice: Invoice): Invoice {
    if (invoice.status === InvoiceStatus.VOIDED) {
  return invoice;
}
    const totalAmount = Number(invoice.totalAmount);
    const paidAmount = Number(invoice.paidAmount);
    const dueDate = new Date(invoice.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    if (totalAmount > 0 && paidAmount >= totalAmount) {
      invoice.status = InvoiceStatus.PAID;
    } else if (dueDate < today) {
      invoice.status = InvoiceStatus.OVERDUE;
    } else if (paidAmount > 0) {
      invoice.status = InvoiceStatus.PARTIALLY_PAID;
    } else {
      invoice.status = InvoiceStatus.UNPAID;
    }

    return invoice;
  }

  async createInvoice(dto: CreateInvoiceDto, createdBy: User): Promise<Invoice> {
    const { tenant, property, unit } =
      await this.housingService.findInvoiceParties(
        dto.propertyId,
        dto.tenantId,
        dto.unitId,
        createdBy,
      );


    const rent = Number(dto.rentAmount || 0);
    const electricity = Number(dto.electricityAmount || 0);
    const water = Number(dto.waterAmount || 0);
    const other = Number(dto.otherFees || 0);
    const totalAmount = rent + electricity + water + other;

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const invoice = this.invoiceRepo.create({
      invoiceNumber,
      tenant,
      property,
      unit,
      rentAmount: rent,
      electricityAmount: electricity,
      waterAmount: water,
      otherFees: other,
      totalAmount,
      paidAmount: 0,
      dueDate: new Date(dto.dueDate),
      utilitySplitNotes: dto.utilitySplitNotes,
      status: InvoiceStatus.UNPAID,
    });

    return this.invoiceRepo.save(invoice);
  }

  async updateInvoice(
  id: string,
  dto: UpdateInvoiceDto,
  user: User,
): Promise<Invoice> {
    const invoice = await this.findInvoiceById(id);
    if (
  user.role !== Role.UNIVERSITY_ADMIN &&
  invoice.property?.manager?.id !== user.id
) {
  throw new ForbiddenException(
    'You are not authorized to edit invoices for this property.',
  );
}
    if (invoice.status === InvoiceStatus.VOIDED) {
      throw new BadRequestException('A voided invoice cannot be edited.');
    }

    if (Number(invoice.paidAmount) > 0 || (invoice.payments?.length ?? 0) > 0) {
      throw new BadRequestException(
        'An invoice with recorded payments cannot be edited.',
      );
    }

    const rent =
      dto.rentAmount !== undefined
        ? Number(dto.rentAmount)
        : Number(invoice.rentAmount);

    const electricity =
      dto.electricityAmount !== undefined
        ? Number(dto.electricityAmount)
        : Number(invoice.electricityAmount);

    const water =
      dto.waterAmount !== undefined
        ? Number(dto.waterAmount)
        : Number(invoice.waterAmount);

    const other =
      dto.otherFees !== undefined
        ? Number(dto.otherFees)
        : Number(invoice.otherFees);

    invoice.rentAmount = rent;
    invoice.electricityAmount = electricity;
    invoice.waterAmount = water;
    invoice.otherFees = other;
    invoice.totalAmount = rent + electricity + water + other;

    if (dto.dueDate !== undefined) {
      invoice.dueDate = new Date(dto.dueDate);
    }

    if (dto.utilitySplitNotes !== undefined) {
      invoice.utilitySplitNotes = dto.utilitySplitNotes;
    }

    invoice.paidAmount = 0;
    invoice.status = InvoiceStatus.UNPAID;

    return this.invoiceRepo.save(invoice);
  }

  async voidInvoice(id: string, user: User): Promise<Invoice> {
    const invoice = await this.findInvoiceById(id);
if (
  user.role !== Role.UNIVERSITY_ADMIN &&
  invoice.property?.manager?.id !== user.id
) {
  throw new ForbiddenException(
    'You are not authorized to void invoices for this property.',
  );
}
    if (invoice.status === InvoiceStatus.VOIDED) {
      throw new BadRequestException('This invoice is already voided.');
    }

    if (Number(invoice.paidAmount) > 0 || (invoice.payments?.length ?? 0) > 0) {
      throw new BadRequestException(
        'An invoice with recorded payments cannot be voided.',
      );
    }

    invoice.status = InvoiceStatus.VOIDED;

    return this.invoiceRepo.save(invoice);
  }

  async recordPayment(dto: RecordPaymentDto, recordedBy?: User): Promise<Payment> {
    const invoice = await this.findInvoiceById(
      dto.invoiceId,
      recordedBy?.role === Role.STUDENT ? recordedBy.id : undefined,
    );
    if (invoice.status === InvoiceStatus.VOIDED) {
  throw new BadRequestException(
    'Payments cannot be recorded against a voided invoice.',
  );
}
    const outstandingBalance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    if (dto.amount <= 0 || dto.amount > outstandingBalance) {
      throw new BadRequestException('Payment amount must be greater than zero and no more than the outstanding balance');
    }

    const payment = this.paymentRepo.create({
      invoice,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      offlineReferenceId: dto.offlineReferenceId,
      receiptUrl: dto.receiptUrl,
      isSynced: true,
      recordedBy,
    });

    const paidAmount = Number(invoice.paidAmount) + Number(dto.amount);
    const status =
      paidAmount >= Number(invoice.totalAmount)
        ? InvoiceStatus.PAID
        : InvoiceStatus.PARTIALLY_PAID;

    return this.invoiceRepo.manager.transaction(async (manager) => {
      const savedPayment = await manager.getRepository(Payment).save(payment);
      await manager.getRepository(Invoice).update(invoice.id, { paidAmount, status });
      return savedPayment;
    });
  }
  async getFinancialSummary(filters: {
    propertyId?: string;
    startDate?: string;
    endDate?: string;
    status?: InvoiceStatus;
  }) {
    const allInvoices = await this.findAllInvoices();

    const isWithinRange = (value: string | Date, start?: string, end?: string) => {
      const date = value instanceof Date
        ? value.toISOString().slice(0, 10)
        : String(value).slice(0, 10);

      return (!start || date >= start) && (!end || date <= end);
    };

    const toCents = (value: number | string) =>
      Math.round(Number(value) * 100);

    const filteredInvoices = allInvoices.filter((invoice) => {
  // Voided invoices should not affect normal financial totals.
  if (invoice.status === InvoiceStatus.VOIDED) {
    return false;
  }

  if (filters.propertyId && invoice.property?.id !== filters.propertyId) {
    return false;
  }

  if (filters.status && invoice.status !== filters.status) {
    return false;
  }

  return isWithinRange(
    invoice.createdAt,
    filters.startDate,
    filters.endDate,
  );
});

    let collectedCents = 0;
    let outstandingCents = 0;
    let overdueCents = 0;

    const anomalies: {
      invoiceId: string;
      invoiceNumber: string;
      type: string;
      message: string;
    }[] = [];

    const today = new Date().toISOString().slice(0, 10);

    for (const invoice of filteredInvoices) {
      const totalCents = toCents(invoice.totalAmount);
      const paidCents = toCents(invoice.paidAmount);
      const remainingCents = Math.max(totalCents - paidCents, 0);

      for (const payment of invoice.payments ?? []) {
        const amountCents = toCents(payment.amount);

        if (
          isWithinRange(
            payment.paymentDate,
            filters.startDate,
            filters.endDate,
          )
        ) {
          collectedCents += amountCents;
        }

        if (amountCents <= 0) {
          anomalies.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            type: 'invalid_payment_amount',
            message: `Payment ${payment.id} has a zero or negative amount.`,
          });
        }
      }

      if (paidCents < 0 || paidCents > totalCents) {
        anomalies.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          type: 'invalid_invoice_balance',
          message: 'The recorded paid amount is outside the invoice total range.',
        });
      }

      const recordedPaymentsCents = (invoice.payments ?? []).reduce(
        (sum, payment) => sum + toCents(payment.amount),
        0,
      );

      if (recordedPaymentsCents !== paidCents) {
        anomalies.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          type: 'payment_balance_mismatch',
          message: 'The sum of payment records differs from the invoice paid amount.',
        });
      }

      outstandingCents += remainingCents;

      const dueDate = String(invoice.dueDate).slice(0, 10);
      if (dueDate < today && remainingCents > 0) {
        overdueCents += remainingCents;
      }
    }

    return {
      filters,
      totals: {
        totalCollected: collectedCents / 100,
        outstanding: outstandingCents / 100,
        overdue: overdueCents / 100,
      },
      invoiceCount: filteredInvoices.length,
      invoices: filteredInvoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        propertyName: invoice.property?.name ?? 'Unknown property',
        tenantName: invoice.tenant?.fullName ?? 'Unknown tenant',
        totalAmount: Number(invoice.totalAmount),
        paidAmount: Number(invoice.paidAmount),
        outstanding: Math.max(
          toCents(invoice.totalAmount) - toCents(invoice.paidAmount),
          0,
        ) / 100,
        status: invoice.status,
        dueDate: String(invoice.dueDate).slice(0, 10),
        createdAt: invoice.createdAt,
      })),
      anomalies,
      anomalyCount: anomalies.length,
    };
  }
}
