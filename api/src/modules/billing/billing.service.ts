import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  Not,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { Lease } from '../housing/entities/application.entity';
import { Property, Unit } from '../housing/entities/property.entity';
import {
  CreateInvoiceDto,
  GenerateInvoiceDto,
  InvoiceListQueryDto,
  RecordPaymentDto,
  UpdateInvoiceStatusDto,
} from './dto/billing.dto';
import { AuditRequestMetadata, AuditService } from './audit.service';
import { calculateInvoiceTotals } from './billing.calculation';
import {
  Invoice,
  InvoiceAuditAction,
  InvoiceAuditLog,
  InvoiceItem,
  InvoiceItemCategory,
  InvoiceStatus,
  Payment,
} from './entities/invoice.entity';

@Injectable()
export class BillingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Lease)
    private readonly leaseRepo: Repository<Lease>,
  ) {}

  async findAllInvoices(actor: User): Promise<Invoice[]> {
    const query = this.invoiceRepo.createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.tenant', 'tenant')
      .leftJoinAndSelect('invoice.property', 'property')
      .leftJoin('property.manager', 'manager')
      .leftJoinAndSelect('invoice.unit', 'unit')
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoinAndSelect('invoice.payments', 'payments')
      .orderBy('invoice.createdAt', 'DESC');

    if (actor.role === Role.STUDENT) {
      query.andWhere('tenant.id = :userId', { userId: actor.id });
    } else if (actor.role === Role.PROPERTY_MANAGER) {
      query.andWhere('manager.id = :managerId', { managerId: actor.id });
    }
    return query.getMany();
  }

  async listPropertyInvoices(
    propertyId: string,
    query: InvoiceListQueryDto,
    actor: User,
  ) {
    await this.assertPropertyAccess(propertyId, actor);

    const builder = this.invoiceRepo.createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.tenant', 'tenant')
      .leftJoinAndSelect('invoice.property', 'property')
      .leftJoinAndSelect('invoice.unit', 'unit')
      .leftJoinAndSelect('invoice.items', 'items')
      .where('property.id = :propertyId', { propertyId })
      .orderBy('invoice.createdAt', 'DESC');
    if (query.status) builder.andWhere('invoice.status = :status', { status: query.status });
    if (query.from) builder.andWhere('invoice.dueDate >= :from', { from: query.from });
    if (query.to) builder.andWhere('invoice.dueDate <= :to', { to: query.to });

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const [items, total] = await builder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { items, total, page, limit, pageCount: Math.ceil(total / limit) };
  }

  async listPropertyLeases(propertyId: string, actor: User) {
    await this.assertPropertyAccess(propertyId, actor);
    const leases = await this.leaseRepo.createQueryBuilder('lease')
      .leftJoinAndSelect('lease.tenant', 'tenant')
      .leftJoinAndSelect('lease.unit', 'unit')
      .leftJoinAndSelect('unit.property', 'property')
      .where('property.id = :propertyId', { propertyId })
      .andWhere('lease.isActive = :isActive', { isActive: true })
      .orderBy('tenant.fullName', 'ASC')
      .getMany();
    return leases.map((lease) => ({
      id: lease.id,
      tenant: { id: lease.tenant.id, fullName: lease.tenant.fullName, email: lease.tenant.email },
      unit: { id: lease.unit.id, roomNumber: lease.unit.roomNumber },
      monthlyRate: Number(lease.monthlyRate),
      startDate: lease.startDate,
      endDate: lease.endDate ?? null,
    }));
  }

  async findInvoiceById(id: string, actor?: User): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['tenant', 'property', 'property.manager', 'unit', 'lease', 'items', 'payments', 'createdBy'],
    });
    if (!invoice) throw new NotFoundException(`Invoice with ID ${id} not found`);
    if (actor) await this.assertInvoiceAccess(invoice, actor);
    return invoice;
  }

  async getAuditTrail(id: string, actor: User) {
    const invoice = await this.findInvoiceById(id, actor);
    return this.dataSource.getRepository(InvoiceAuditLog)
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.actor', 'actor')
      .where('audit.invoice = :invoiceId', { invoiceId: invoice.id })
      .orderBy('audit.createdAt', 'ASC')
      .addOrderBy('audit.id', 'ASC')
      .getMany();
  }

  async generateInvoice(
    propertyId: string,
    dto: GenerateInvoiceDto,
    actor: User,
    metadata: AuditRequestMetadata = {},
  ): Promise<Invoice> {
    this.assertManager(actor);
    this.validateBillingPeriod(dto);

    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      const propertyRepository = runner.manager.getRepository(Property);
      const lockedProperty = await propertyRepository.createQueryBuilder('property')
        .where('property.id = :propertyId', { propertyId })
        .setLock('pessimistic_write')
        .getOne();
      const property = lockedProperty
        ? await propertyRepository.findOne({ where: { id: propertyId }, relations: ['manager'] })
        : null;
      if (
        !property
        || (actor.role !== Role.UNIVERSITY_ADMIN && property.manager?.id !== actor.id)
      ) {
        throw new NotFoundException('Property not found or not managed by current user');
      }

      const tenant = await runner.manager.getRepository(User).findOne({
        where: { id: dto.tenantId, role: Role.STUDENT, isActive: true },
      });
      if (!tenant) throw new NotFoundException('Active tenant not found');

      const duplicate = await runner.manager.getRepository(Invoice).findOne({
        where: {
          property: { id: property.id },
          tenant: { id: tenant.id },
          billingPeriodStart: new Date(dto.billingPeriodStart),
          billingPeriodEnd: new Date(dto.billingPeriodEnd),
          status: Not(InvoiceStatus.VOIDED),
        },
      });
      if (duplicate) {
        throw new ConflictException('An invoice already exists for this tenant and billing period');
      }
      const voidedInvoice = await runner.manager.getRepository(Invoice).findOne({
        where: {
          property: { id: property.id },
          tenant: { id: tenant.id },
          billingPeriodStart: new Date(dto.billingPeriodStart),
          billingPeriodEnd: new Date(dto.billingPeriodEnd),
          status: InvoiceStatus.VOIDED,
        },
      });
      if (voidedInvoice && !dto.notes?.trim()) {
        throw new BadRequestException('A reason is required when re-issuing a voided billing period');
      }

      let lease: Lease | null = null;
      let unit: Unit | null = null;
      if (dto.leaseId) {
        lease = await runner.manager.getRepository(Lease).findOne({
          where: { id: dto.leaseId, isActive: true },
          relations: ['tenant', 'unit', 'unit.property'],
        });
        if (!lease || lease.tenant.id !== tenant.id || lease.unit.property.id !== property.id) {
          throw new BadRequestException('The selected active lease does not belong to this tenant and property');
        }
        const periodStart = new Date(dto.billingPeriodStart);
        const periodEnd = new Date(dto.billingPeriodEnd);
        if (new Date(lease.startDate) > periodStart || (lease.endDate && new Date(lease.endDate) < periodEnd)) {
          throw new BadRequestException('The billing period falls outside the selected lease dates');
        }
        unit = lease.unit;
        if (dto.unitId && dto.unitId !== unit.id) {
          throw new BadRequestException('The selected unit does not match the active lease');
        }
      } else if (dto.unitId) {
        unit = await runner.manager.getRepository(Unit).findOne({
          where: { id: dto.unitId, property: { id: property.id } },
        });
        if (!unit) throw new BadRequestException('The selected unit does not belong to this property');
      }

      const itemInputs = [...(dto.items ?? [])];
      const rentItem = itemInputs.find((item) => item.category === InvoiceItemCategory.RENT);
      const rentAmount = lease ? Number(lease.monthlyRate) : Number(dto.rentAmount ?? rentItem?.amount ?? 0);
      if (rentAmount <= 0) {
        throw new BadRequestException('A positive rent amount or active lease is required');
      }
      if (rentItem && Number(rentItem.amount) !== rentAmount) {
        throw new BadRequestException('Rent line item must match the rent amount');
      }
      if (itemInputs.some((item) =>
        typeof item.description !== 'string' || !item.description.trim()
      )) {
        throw new BadRequestException('Invoice items require a description');
      }
      if (!rentItem) {
        itemInputs.unshift({
          description: `Rent${unit ? ` - Unit ${unit.roomNumber}` : ''}`,
          category: InvoiceItemCategory.RENT,
          amount: rentAmount,
        });
      }

      const propertyPrefix = property.id.replace(/-/g, '').slice(0, 8).toUpperCase();
      const billingMonth = dto.billingPeriodStart.slice(0, 7).replace('-', '');
      const count = await runner.manager.getRepository(Invoice).count({
        where: {
          property: { id: property.id },
          billingPeriodStart: new Date(dto.billingPeriodStart),
        },
      });
      const items = itemInputs.map((item) => runner.manager.getRepository(InvoiceItem).create({
        description: item.description.trim(),
        category: item.category,
        amount: Number(item.amount),
      }));
      const tax = Number(dto.tax ?? 0);
      const totals = calculateInvoiceTotals(items, tax);
      const invoice = runner.manager.getRepository(Invoice).create({
        invoiceNumber: `INV-${billingMonth}-PROP${propertyPrefix}-${String(count + 1).padStart(3, '0')}`,
        property,
        tenant,
        lease: lease ?? undefined,
        unit: unit ?? undefined,
        billingPeriodStart: new Date(dto.billingPeriodStart),
        billingPeriodEnd: new Date(dto.billingPeriodEnd),
        dueDate: new Date(dto.dueDate),
        ...totals,
        paidAmount: 0,
        rentAmount,
        electricityAmount: items
          .filter((item) => item.category === InvoiceItemCategory.UTILITY && /electric/i.test(item.description))
          .reduce((sum, item) => sum + Number(item.amount), 0),
        waterAmount: items
          .filter((item) => item.category === InvoiceItemCategory.UTILITY && /water/i.test(item.description))
          .reduce((sum, item) => sum + Number(item.amount), 0),
        otherFees: items
          .filter((item) => item.category !== InvoiceItemCategory.RENT && item.category !== InvoiceItemCategory.UTILITY)
          .reduce((sum, item) => sum + Number(item.amount), 0),
        utilitySplitNotes: dto.notes,
        createdBy: actor,
        status: InvoiceStatus.DRAFT,
        items,
      });
      const invoiceRepository = runner.manager.getRepository(Invoice);
      const saved = await invoiceRepository.save(invoice);
      saved.items = items;
      saved.status = InvoiceStatus.ISSUED;
      await invoiceRepository.save(saved);
      await this.auditService.logAction(
        runner.manager,
        saved,
        InvoiceAuditAction.GENERATED,
        actor,
        { ...metadata, ...(dto.notes ? { notes: dto.notes } : {}) },
      );
      await runner.commitTransaction();
      return saved;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      if (error instanceof QueryFailedError && error.driverError?.code === '23505') {
        throw new ConflictException('An invoice already exists for this tenant and billing period');
      }
      throw error;
    } finally {
      await runner.release();
    }
  }

  async createInvoice(
    dto: CreateInvoiceDto,
    actor: User,
    metadata: AuditRequestMetadata = {},
  ): Promise<Invoice> {
    const dueDate = new Date(dto.dueDate);
    const periodStart = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth() + 1, 0));
    const items = [
      { description: 'Rent', category: InvoiceItemCategory.RENT, amount: Number(dto.rentAmount) },
      ...(Number(dto.electricityAmount ?? 0) > 0
        ? [{ description: 'Electricity', category: InvoiceItemCategory.UTILITY, amount: Number(dto.electricityAmount) }]
        : []),
      ...(Number(dto.waterAmount ?? 0) > 0
        ? [{ description: 'Water', category: InvoiceItemCategory.UTILITY, amount: Number(dto.waterAmount) }]
        : []),
      ...(Number(dto.otherFees ?? 0) > 0
        ? [{ description: 'Other fees', category: InvoiceItemCategory.PARKING, amount: Number(dto.otherFees) }]
        : []),
    ];
    return this.generateInvoice(dto.propertyId, {
      tenantId: dto.tenantId,
      unitId: dto.unitId,
      billingPeriodStart: periodStart.toISOString().slice(0, 10),
      billingPeriodEnd: periodEnd.toISOString().slice(0, 10),
      dueDate: dto.dueDate,
      rentAmount: Number(dto.rentAmount),
      items,
      notes: dto.utilitySplitNotes,
    }, actor, metadata);
  }

  async updateStatus(
    id: string,
    dto: UpdateInvoiceStatusDto,
    actor: User,
    metadata: AuditRequestMetadata = {},
  ): Promise<Invoice> {
    this.assertManager(actor);
    if (dto.status === InvoiceStatus.VOIDED && !dto.notes?.trim()) {
      throw new BadRequestException('A reason is required to void an invoice');
    }

    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      const invoiceRepository = runner.manager.getRepository(Invoice);
      const lockedInvoice = await invoiceRepository.createQueryBuilder('invoice')
        .where('invoice.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne();
      const invoice = lockedInvoice
        ? await invoiceRepository.findOne({
          where: { id },
          relations: ['property', 'property.manager', 'tenant', 'unit', 'lease', 'items', 'createdBy'],
        })
        : null;
      if (!invoice) throw new NotFoundException(`Invoice with ID ${id} not found`);
      await this.assertInvoiceAccess(invoice, actor);
      const allowed: Record<InvoiceStatus, InvoiceStatus[]> = {
        [InvoiceStatus.DRAFT]: [InvoiceStatus.ISSUED, InvoiceStatus.VOIDED],
        [InvoiceStatus.ISSUED]: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.VOIDED],
        [InvoiceStatus.PAID]: [],
        [InvoiceStatus.OVERDUE]: [InvoiceStatus.ISSUED, InvoiceStatus.PAID, InvoiceStatus.VOIDED],
        [InvoiceStatus.VOIDED]: [],
      };
      if (!allowed[invoice.status].includes(dto.status)) {
        throw new BadRequestException(`Cannot change invoice status from ${invoice.status} to ${dto.status}`);
      }
      const previousStatus = invoice.status;
      invoice.status = dto.status;
      await runner.manager.getRepository(Invoice).save(invoice);
      await this.auditService.logAction(
        runner.manager,
        invoice,
        dto.status === InvoiceStatus.VOIDED
          ? InvoiceAuditAction.VOIDED
          : dto.status === InvoiceStatus.ISSUED && previousStatus === InvoiceStatus.DRAFT
            ? InvoiceAuditAction.ISSUED
            : InvoiceAuditAction.STATUS_UPDATED,
        actor,
        { ...metadata, ...(dto.notes ? { notes: dto.notes } : {}) },
      );
      await runner.commitTransaction();
      return invoice;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async recordPayment(
    dto: RecordPaymentDto,
    recordedBy: User,
    metadata: AuditRequestMetadata = {},
  ): Promise<Payment> {
    if (!Number.isFinite(Number(dto.amount)) || Number(dto.amount) <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      const invoiceRepository = runner.manager.getRepository(Invoice);
      const lockedInvoice = await invoiceRepository.createQueryBuilder('invoice')
        .where('invoice.id = :id', { id: dto.invoiceId })
        .setLock('pessimistic_write')
        .getOne();
      const invoice = lockedInvoice
        ? await invoiceRepository.findOne({
          where: { id: dto.invoiceId },
          relations: ['tenant', 'property', 'property.manager', 'unit', 'lease', 'items', 'createdBy'],
        })
        : null;
      if (!invoice) throw new NotFoundException(`Invoice with ID ${dto.invoiceId} not found`);
      await this.assertInvoiceAccess(invoice, recordedBy);
      if ([InvoiceStatus.DRAFT, InvoiceStatus.VOIDED, InvoiceStatus.PAID].includes(invoice.status)) {
        throw new BadRequestException(`Payments cannot be recorded for an invoice in ${invoice.status} status`);
      }
      if (Number(invoice.paidAmount) + Number(dto.amount) > Number(invoice.totalAmount)) {
        throw new BadRequestException('Payment exceeds the outstanding invoice balance');
      }
      const payment = runner.manager.getRepository(Payment).create({
        invoice,
        amount: Number(dto.amount),
        paymentMethod: dto.paymentMethod,
        offlineReferenceId: dto.offlineReferenceId,
        receiptUrl: dto.receiptUrl,
        isSynced: true,
        recordedBy,
      });
      const savedPayment = await runner.manager.getRepository(Payment).save(payment);
      invoice.paidAmount = Number(invoice.paidAmount) + Number(dto.amount);
      if (invoice.paidAmount >= Number(invoice.totalAmount)) invoice.status = InvoiceStatus.PAID;
      await runner.manager.getRepository(Invoice).save(invoice);
      await this.auditService.logAction(
        runner.manager,
        invoice,
        InvoiceAuditAction.STATUS_UPDATED,
        recordedBy,
        { ...metadata, notes: `Payment recorded: ${Number(dto.amount).toFixed(2)} ${dto.paymentMethod}` },
      );
      await runner.commitTransaction();
      return savedPayment;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private validateBillingPeriod(dto: GenerateInvoiceDto): void {
    const start = new Date(dto.billingPeriodStart);
    const end = new Date(dto.billingPeriodEnd);
    const due = new Date(dto.dueDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || Number.isNaN(due.getTime())
      || start > end || due < start) {
      throw new BadRequestException('Billing period dates or due date are invalid');
    }
    if (dto.tax !== undefined && (!Number.isFinite(Number(dto.tax)) || Number(dto.tax) < 0)) {
      throw new BadRequestException('Tax cannot be negative');
    }
  }

  private assertManager(actor: User): void {
    if (![Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN].includes(actor.role)) {
      throw new ForbiddenException('Only property managers and university administrators can manage invoices');
    }
  }

  private async assertPropertyAccess(propertyId: string, actor: User): Promise<void> {
    this.assertManager(actor);
    const query = this.dataSource.getRepository(Property).createQueryBuilder('property')
      .leftJoin('property.manager', 'manager')
      .where('property.id = :propertyId', { propertyId });
    if (actor.role !== Role.UNIVERSITY_ADMIN) {
      query.andWhere('manager.id = :actorId', { actorId: actor.id });
    }
    if (!await query.getOne()) {
      throw new NotFoundException('Property not found or not managed by current user');
    }
  }

  private async assertInvoiceAccess(invoice: Invoice, actor: User): Promise<void> {
    if (actor.role === Role.UNIVERSITY_ADMIN) return;
    if (actor.role === Role.STUDENT) {
      if (invoice.tenant?.id !== actor.id) throw new NotFoundException('Invoice not found');
      return;
    }
    if (actor.role === Role.PROPERTY_MANAGER && invoice.property?.manager?.id === actor.id) return;
    throw new ForbiddenException('You do not have access to this invoice');
  }
}
