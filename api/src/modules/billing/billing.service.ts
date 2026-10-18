import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus, Payment } from './entities/invoice.entity';
import { Lease } from '../housing/entities/application.entity';
import { CreateInvoiceDto, RecordPaymentDto } from './dto/billing.dto';
import { UsersService } from '../users/users.service';
import { HousingService } from '../housing/housing.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import {
  detectPaymentAnomalies,
  flagUnassignedPayments,
} from './payment-anomaly.detector';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Lease)
    private readonly leaseRepo: Repository<Lease>,
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
    invoices.forEach((invoice) => this.refreshInvoiceStatus(invoice));
    const activeLeases = await this.findActiveLeases();
    return detectPaymentAnomalies(invoices, activeLeases);
  }

  async findUnassignedPayments(): Promise<Payment[]> {
    const payments = await this.paymentRepo.createQueryBuilder('payment')
      .leftJoinAndSelect('payment.invoice', 'invoice')
      .where('invoice.id IS NULL')
      .orderBy('payment.paymentDate', 'DESC')
      .getMany();
    return flagUnassignedPayments(payments);
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
    this.refreshInvoiceStatus(invoice);

    const relatedInvoices = invoice.tenant?.id && invoice.property?.id
      ? await this.findTenantPropertyInvoices(invoice.tenant.id, invoice.property.id)
      : [invoice];
    const activeLeases = invoice.tenant?.id && invoice.property?.id
      ? await this.findActiveLeases(invoice.tenant.id, invoice.property.id)
      : [];
    const invoicesWithAnomalies = detectPaymentAnomalies(relatedInvoices, activeLeases);
    const annotatedInvoice = invoicesWithAnomalies.find(
      (relatedInvoice) => relatedInvoice.id === invoice.id,
    );
    if (!annotatedInvoice) {
      throw new InternalServerErrorException('The invoice could not be reloaded for anomaly review');
    }
    return annotatedInvoice;
  }

  private findTenantPropertyInvoices(tenantId: string, propertyId: string): Promise<Invoice[]> {
    return this.invoiceRepo.createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.tenant', 'tenant')
      .leftJoinAndSelect('invoice.property', 'property')
      .leftJoinAndSelect('invoice.unit', 'unit')
      .leftJoinAndSelect('invoice.payments', 'payments')
      .where('tenant.id = :tenantId', { tenantId })
      .andWhere('property.id = :propertyId', { propertyId })
      .getMany();
  }

  private findActiveLeases(tenantId?: string, propertyId?: string): Promise<Lease[]> {
    const today = new Date().toISOString().slice(0, 10);
    const query = this.leaseRepo.createQueryBuilder('lease')
      .leftJoinAndSelect('lease.tenant', 'tenant')
      .leftJoinAndSelect('lease.unit', 'unit')
      .leftJoinAndSelect('unit.property', 'property')
      .where('lease.isActive = :isActive', { isActive: true })
      .andWhere('lease.startDate <= :today', { today })
      .andWhere('(lease.endDate IS NULL OR lease.endDate >= :today)', { today });

    if (tenantId) query.andWhere('tenant.id = :tenantId', { tenantId });
    if (propertyId) query.andWhere('property.id = :propertyId', { propertyId });
    return query.getMany();
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

    const savedPayment = await this.invoiceRepo.manager.transaction(async (manager) => {
      const savedPayment = await manager.getRepository(Payment).save(payment);
      await manager.getRepository(Invoice).update(invoice.id, { paidAmount, status });
      return savedPayment;
    });

    const relatedInvoices = await this.findTenantPropertyInvoices(
      invoice.tenant.id,
      invoice.property.id,
    );
    const activeLeases = await this.findActiveLeases(invoice.tenant.id, invoice.property.id);
    detectPaymentAnomalies(relatedInvoices, activeLeases);
    const detectedPayment = relatedInvoices
      .flatMap((relatedInvoice) => relatedInvoice.payments || [])
      .find((relatedPayment) => relatedPayment.id === savedPayment.id);
    if (!detectedPayment) {
      throw new InternalServerErrorException('The recorded payment could not be reloaded for anomaly review');
    }

    savedPayment.is_anomaly = detectedPayment.is_anomaly;
    savedPayment.anomaly_details = detectedPayment.anomaly_details;
    return savedPayment;
  }
}
