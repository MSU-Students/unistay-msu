import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus, Payment } from './entities/invoice.entity';
import { CreateInvoiceDto, RecordPaymentDto } from './dto/billing.dto';
import { UsersService } from '../users/users.service';
import { HousingService } from '../housing/housing.service';
import { User } from '../users/entities/user.entity';
import { FinanceSummaryQueryDto, FinanceSummaryResponseDto } from './dto/finance.dto';
import { ExportJob, ExportJobStatus } from './entities/export-job.entity';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(ExportJob)
    private readonly exportJobRepo: Repository<ExportJob>,
    private readonly usersService: UsersService,
    private readonly housingService: HousingService,
    private readonly configService: ConfigService,
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
    const { propertyId, startDate, endDate } = query;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    // Total collected: sum of payments
    const paymentQb = this.paymentRepo.createQueryBuilder('payment')
      .leftJoin('payment.invoice', 'invoice');

    if (propertyId) {
      paymentQb.andWhere('invoice.propertyId = :propertyId', { propertyId });
    }
    if (start) {
      paymentQb.andWhere('payment.createdAt >= :start', { start: start.toISOString() });
    }
    if (end) {
      paymentQb.andWhere('payment.createdAt <= :end', { end: end.toISOString() });
    }

    const collectedRaw = await paymentQb.select('COALESCE(SUM(payment.amount), 0)', 'sum').getRawOne();
    const totalCollected = Number(collectedRaw?.sum || 0);

    // Outstanding: sum of invoice balances for invoices not fully paid/voided
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

    invoiceQb.andWhere('invoice.status NOT IN (:...excluded)', { excluded: [InvoiceStatus.PAID] });
    const outstandingRaw = await invoiceQb.select('COALESCE(SUM(invoice.totalAmount - COALESCE(invoice.paidAmount, 0)), 0)', 'sum').getRawOne();
    const totalOutstanding = Number(outstandingRaw?.sum || 0);

    // Overdue
    const nowIso = new Date().toISOString();
    const overdueQb = this.invoiceRepo.createQueryBuilder('invoice');
    if (propertyId) overdueQb.andWhere('invoice.propertyId = :propertyId', { propertyId });
    overdueQb.andWhere('invoice.dueDate < :now', { now: nowIso });
    overdueQb.andWhere('invoice.status NOT IN (:...excluded)', { excluded: [InvoiceStatus.PAID] });
    const overdueRaw = await overdueQb.select('COALESCE(SUM(invoice.totalAmount - COALESCE(invoice.paidAmount, 0)), 0)', 'sum').getRawOne();
    const totalOverdue = Number(overdueRaw?.sum || 0);

    // Breakdown by property
    const breakdownQb = this.invoiceRepo.createQueryBuilder('invoice')
      .leftJoin('invoice.property', 'property')
      .select('property.id', 'propertyId')
      .addSelect('COALESCE(SUM(invoice.paidAmount),0)', 'collected')
      .addSelect('COALESCE(SUM(invoice.totalAmount - COALESCE(invoice.paidAmount,0)),0)', 'outstanding')
      .addSelect(`COALESCE(SUM(CASE WHEN invoice.dueDate < :now AND invoice.status NOT IN (:...excluded) THEN (invoice.totalAmount - COALESCE(invoice.paidAmount,0)) ELSE 0 END),0)`, 'overdue')
      .groupBy('property.id')
      .setParameters({ now: nowIso, excluded: [InvoiceStatus.PAID] });

    if (propertyId) breakdownQb.andWhere('property.id = :propertyId', { propertyId });
    if (start) breakdownQb.andWhere('invoice.createdAt >= :start', { start: start.toISOString() });
    if (end) breakdownQb.andWhere('invoice.createdAt <= :end', { end: end.toISOString() });

    const breakdownRaw = await breakdownQb.getRawMany();
    const breakdown = breakdownRaw.map(r => ({
      propertyId: r.propertyId,
      collected: Number(r.collected || 0),
      outstanding: Number(r.outstanding || 0),
      overdue: Number(r.overdue || 0),
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

  // Create a background export job and start processing asynchronously
  async createExportJob(query: FinanceSummaryQueryDto, requestedBy?: User): Promise<ExportJob> {
    const job = this.exportJobRepo.create({
      type: 'finance_summary',
      filters: query,
      status: ExportJobStatus.PENDING,
      format: query.export || 'csv',
    });
    const saved = await this.exportJobRepo.save(job);

    // Kick off async processing (fire-and-forget)
    this.processExportJob(saved).catch(err => {
      this.logger.error('Failed to process export job', err);
    });

    return saved;
  }

  private async processExportJob(job: ExportJob) {
    await this.exportJobRepo.update({ id: job.id }, { status: ExportJobStatus.PROCESSING });
    try {
      const summary = await this.getFinancialSummary(job.filters || {});

      // Build CSV (simple): header + breakdown
      const csv = this.buildCsvFromSummary(summary);
      const objectKey = `exports/finance-summary-${job.id}.csv`;

      // Upload to MinIO
      const minioClient = this.getMinioClient();
      const bucket = this.configService.get<string>('storage.bucketName') || process.env.MINIO_BUCKET_NAME || 'unistay-media';

      // Ensure bucket exists (putObject will create implicitly in MinIO)
      await minioClient.putObject(bucket, objectKey, Buffer.from(csv));

      await this.exportJobRepo.update({ id: job.id }, { status: ExportJobStatus.COMPLETED, objectKey });
    } catch (err) {
      this.logger.error('Export job failed', err);
      await this.exportJobRepo.update({ id: job.id }, { status: ExportJobStatus.FAILED, errorMessage: (err as Error).message });
    }
  }

  private buildCsvFromSummary(summary: FinanceSummaryResponseDto): string {
    const lines: string[] = [];
    lines.push('Generated At,' + summary.generatedAt);
    lines.push('Total Collected,' + summary.totalCollected.toFixed(2));
    lines.push('Total Outstanding,' + summary.totalOutstanding.toFixed(2));
    lines.push('Total Overdue,' + summary.totalOverdue.toFixed(2));
    lines.push('');
    lines.push('Property ID,Collected,Outstanding,Overdue');
    for (const row of summary.breakdownByProperty) {
      lines.push(`${row.propertyId},${row.collected.toFixed(2)},${row.outstanding.toFixed(2)},${row.overdue.toFixed(2)}`);
    }
    lines.push('');
    lines.push('Anomalies');
    lines.push('Type,Description,Severity');
    for (const a of summary.anomalies) {
      lines.push(`${a.type},"${(a.description || '').replace(/"/g, '""')}",${a.severity || 'low'}`);
    }
    return lines.join('\n');
  }

  private getMinioClient(): any {
    const endpoint = this.configService.get<string>('storage.endPoint') || process.env.MINIO_ENDPOINT || 'localhost';
    const port = Number(this.configService.get<number>('storage.port') || process.env.MINIO_PORT || 9000);
    const useSSL = this.configService.get<boolean>('storage.useSSL') || (process.env.MINIO_USE_SSL === 'true');
    const accessKey = this.configService.get<string>('storage.accessKey') || process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'unistay_admin';
    const secretKey = this.configService.get<string>('storage.secretKey') || process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'unistay_minio_secret_2026';

    // Minio client (callback-based putObject supports Promise when omitted callback in newer SDKs)
    const client = new Minio.Client({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });

    // Wrap putObject to return a Promise if SDK uses callbacks — but minio.putObject returns Promise in modern versions
    (client as any).putObject = (client as any).putObject.bind(client);

    return client;
  }
}
