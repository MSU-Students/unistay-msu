import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { Invoice, InvoiceStatus, Payment } from './entities/invoice.entity';
import { CreateInvoiceDto, RecordPaymentDto } from './dto/billing.dto';
import { UsersService } from '../users/users.service';
import { HousingService } from '../housing/housing.service';
import { User } from '../users/entities/user.entity';
import { FinanceSummaryQueryDto, FinanceSummaryResponseDto } from './dto/finance.dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly usersService: UsersService,
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

  async createInvoice(dto: CreateInvoiceDto): Promise<Invoice> {
    const tenant = await this.usersService.findById(dto.tenantId);
    const property = await this.housingService.findPropertyById(dto.propertyId);
    const unit = dto.unitId
      ? property.units?.find((candidate) => candidate.id === dto.unitId)
      : undefined;
    if (dto.unitId && !unit) {
      throw new BadRequestException('The selected unit does not belong to the selected property');
    }

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

  async recordPayment(dto: RecordPaymentDto, recordedBy?: User): Promise<Payment> {
    const invoice = await this.findInvoiceById(
      dto.invoiceId,
      recordedBy?.role === Role.STUDENT ? recordedBy.id : undefined,
    );
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

  // Financial summary aggregation
  async getFinancialSummary(query: FinanceSummaryQueryDto): Promise<FinanceSummaryResponseDto> {
    const { propertyId, startDate, endDate, status } = query;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    if (end && endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      end.setUTCHours(23, 59, 59, 999);
    }
    const todayIso = new Date().toISOString().slice(0, 10);

    const applyStatusFilter = <T extends ObjectLiteral>(qb: SelectQueryBuilder<T>) => {
      if (!status || status === 'all') return;
      const balance = '(invoice.totalAmount - COALESCE(invoice.paidAmount, 0))';
      switch (status) {
        case InvoiceStatus.PAID:
          qb.andWhere(`${balance} <= 0`);
          break;
        case InvoiceStatus.OVERDUE:
          qb.andWhere('invoice.dueDate < :today', { today: todayIso })
            .andWhere(`${balance} > 0`);
          break;
        case InvoiceStatus.PARTIALLY_PAID:
          qb.andWhere('invoice.dueDate >= :today', { today: todayIso })
            .andWhere('COALESCE(invoice.paidAmount, 0) > 0')
            .andWhere(`${balance} > 0`);
          break;
        case InvoiceStatus.UNPAID:
          qb.andWhere('invoice.dueDate >= :today', { today: todayIso })
            .andWhere('COALESCE(invoice.paidAmount, 0) <= 0')
            .andWhere(`${balance} > 0`);
          break;
      }
    };

    // Collected activity is dated by payment; open balances are dated by invoice creation.
    const paymentQb = this.paymentRepo.createQueryBuilder('payment')
      .innerJoin('payment.invoice', 'invoice');

    if (propertyId) {
      paymentQb.andWhere('invoice.propertyId = :propertyId', { propertyId });
    }
    if (start) {
      paymentQb.andWhere('payment.paymentDate >= :start', { start: start.toISOString() });
    }
    if (end) {
      paymentQb.andWhere('payment.paymentDate <= :end', { end: end.toISOString() });
    }
    applyStatusFilter(paymentQb);

    const collectedRaw = await paymentQb.select('COALESCE(SUM(payment.amount), 0)', 'sum').getRawOne();
    const totalCollected = Number(collectedRaw?.sum || 0);

    // Outstanding: sum of positive balances for invoices matching the selected filters.
    const invoiceQb = this.invoiceRepo.createQueryBuilder('invoice');
    if (propertyId) {
      invoiceQb.andWhere('invoice.propertyId = :propertyId', { propertyId });
    }
    if (start) {
      invoiceQb.andWhere('invoice.createdAt >= :start', { start: start.toISOString() });
    }
    if (end) {
      invoiceQb.andWhere('invoice.createdAt <= :end', { end: end.toISOString() });
    }

    invoiceQb.andWhere('(invoice.totalAmount - COALESCE(invoice.paidAmount, 0)) > 0');
    applyStatusFilter(invoiceQb);
    const outstandingRaw = await invoiceQb.select('COALESCE(SUM(invoice.totalAmount - COALESCE(invoice.paidAmount, 0)), 0)', 'sum').getRawOne();
    const totalOutstanding = Number(outstandingRaw?.sum || 0);

    // Overdue balances use the same invoice-period and payment-status filters.
    const overdueQb = this.invoiceRepo.createQueryBuilder('invoice');
    if (propertyId) overdueQb.andWhere('invoice.propertyId = :propertyId', { propertyId });
    if (start) overdueQb.andWhere('invoice.createdAt >= :start', { start: start.toISOString() });
    if (end) overdueQb.andWhere('invoice.createdAt <= :end', { end: end.toISOString() });
    overdueQb.andWhere('invoice.dueDate < :today', { today: todayIso })
      .andWhere('(invoice.totalAmount - COALESCE(invoice.paidAmount, 0)) > 0');
    applyStatusFilter(overdueQb);
    const overdueRaw = await overdueQb.select('COALESCE(SUM(invoice.totalAmount - COALESCE(invoice.paidAmount, 0)), 0)', 'sum').getRawOne();
    const totalOverdue = Number(overdueRaw?.sum || 0);

    // Breakdown by property
    const breakdownQb = this.invoiceRepo.createQueryBuilder('invoice')
      .leftJoin('invoice.property', 'property')
      .select('property.id', 'propertyId')
      .addSelect('COALESCE(SUM(invoice.totalAmount - COALESCE(invoice.paidAmount,0)),0)', 'outstanding')
      .addSelect(`COALESCE(SUM(CASE WHEN invoice.dueDate < :today AND (invoice.totalAmount - COALESCE(invoice.paidAmount,0)) > 0 THEN (invoice.totalAmount - COALESCE(invoice.paidAmount,0)) ELSE 0 END),0)`, 'overdue')
      .groupBy('property.id')
      .setParameter('today', todayIso);

    if (propertyId) breakdownQb.andWhere('property.id = :propertyId', { propertyId });
    if (start) breakdownQb.andWhere('invoice.createdAt >= :start', { start: start.toISOString() });
    if (end) breakdownQb.andWhere('invoice.createdAt <= :end', { end: end.toISOString() });
    breakdownQb.andWhere('(invoice.totalAmount - COALESCE(invoice.paidAmount, 0)) > 0');
    applyStatusFilter(breakdownQb);

    const breakdownRaw = await breakdownQb.getRawMany();
    const paymentBreakdownQb = this.paymentRepo.createQueryBuilder('payment')
      .innerJoin('payment.invoice', 'invoice')
      .select('invoice.propertyId', 'propertyId')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'collected')
      .groupBy('invoice.propertyId');
    if (propertyId) paymentBreakdownQb.andWhere('invoice.propertyId = :propertyId', { propertyId });
    if (start) paymentBreakdownQb.andWhere('payment.paymentDate >= :start', { start: start.toISOString() });
    if (end) paymentBreakdownQb.andWhere('payment.paymentDate <= :end', { end: end.toISOString() });
    applyStatusFilter(paymentBreakdownQb);
    const paymentBreakdownRaw = await paymentBreakdownQb.getRawMany();
    const collectedByProperty = new Map(
      paymentBreakdownRaw.map((row) => [row.propertyId, Number(row.collected || 0)]),
    );
    const breakdownByProperty = new Map(breakdownRaw.map((row) => [row.propertyId, row]));
    for (const row of paymentBreakdownRaw) {
      if (!breakdownByProperty.has(row.propertyId)) {
        breakdownByProperty.set(row.propertyId, {
          propertyId: row.propertyId,
          outstanding: 0,
          overdue: 0,
        });
      }
    }
    const breakdown = Array.from(breakdownByProperty.values()).map((row) => ({
      propertyId: row.propertyId,
      collected: collectedByProperty.get(row.propertyId) || 0,
      outstanding: Number(row.outstanding || 0),
      overdue: Number(row.overdue || 0),
    }));

    // Simple anomaly detection
    const anomalies: Array<{ type: string; description: string; refs?: string[]; severity?: 'low' | 'medium' | 'high' }> = [];

    const orphanPaymentsCountRaw = await this.paymentRepo.createQueryBuilder('payment')
      .where('payment.invoiceId IS NULL')
      .select('COUNT(1)', 'count')
      .getRawOne();
    const orphanCount = Number(orphanPaymentsCountRaw?.count || 0);
    if (orphanCount > 0) {
      anomalies.push({ type: 'orphan_payments', description: `${orphanCount} payment(s) without an associated invoice`, severity: 'medium' });
    }

    const duplicateRefRaw = await this.paymentRepo.createQueryBuilder('payment')
      .select('payment.offlineReferenceId', 'ref')
      .addSelect('payment.amount', 'amount')
      .addSelect('COUNT(1)', 'count')
      .where('payment.offlineReferenceId IS NOT NULL')
      .groupBy('payment.offlineReferenceId, payment.amount')
      .having('COUNT(1) > 1')
      .limit(10)
      .getRawMany();
    duplicateRefRaw.forEach(d => {
      anomalies.push({ type: 'duplicate_payment_reference', description: `Multiple payments (${d.count}) share provider reference ${d.ref} with amount ${d.amount}`, severity: 'medium' });
    });

    const response: FinanceSummaryResponseDto = {
      totalCollected,
      totalOutstanding,
      totalOverdue,
      breakdownByProperty: breakdown,
      anomalies,
      generatedAt: new Date().toISOString(),
      filters: query,
    };

    return response;
  }
}
