import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Application, ApplicationStatus } from '../housing/entities/application.entity';
import { Invoice, InvoiceStatus } from '../billing/entities/invoice.entity';
import {
  MaintenanceTicket,
  TicketPriority,
  TicketStatus,
} from '../maintenance/entities/ticket.entity';
import { Gig, GigStatus } from '../gigs/entities/gig.entity';
import { Property } from '../housing/entities/property.entity';
import { ReportFilterDto } from './dto/report-filter.dto';
import { REPORT_PAGE_SIZE_DEFAULT, REPORT_THRESHOLDS } from './reports.constants';

type ReportEntity = Application | Invoice | MaintenanceTicket | Gig;

const ACTIVE_TICKET_STATUSES = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS];
const ACTIVE_GIG_STATUSES = [GigStatus.OPEN, GigStatus.ASSIGNED];

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(MaintenanceTicket)
    private readonly ticketRepo: Repository<MaintenanceTicket>,
    @InjectRepository(Gig)
    private readonly gigRepo: Repository<Gig>,
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
  ) {}

  async getOverview(filters: ReportFilterDto) {
    const [applications, billing, maintenance, gigs, properties] = await Promise.all([
      this.applicationSummary(filters),
      this.billingSummary(filters),
      this.maintenanceSummary(filters),
      this.gigSummary(filters),
      this.propertyRepo.count({
        ...(this.propertyIds(filters)
          ? { where: this.propertyIds(filters).map((id) => ({ id })) }
          : {}),
      }),
    ]);

    return {
      applications,
      billing,
      maintenance,
      gigs,
      properties: { total: properties },
      attentionCount:
        applications.pending +
        billing.overdueCount +
        maintenance.staleCount +
        gigs.stalledCount,
    };
  }

  async getApplications(filters: ReportFilterDto) {
    const status = this.validateStatus(filters.status, ApplicationStatus);
    const query = this.applicationRepo
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.applicant', 'applicant')
      .leftJoinAndSelect('application.property', 'property')
      .leftJoinAndSelect('application.unit', 'unit');
    this.applyPropertyFilter(query, 'property', filters);
    this.applyDateFilter(query, 'application.createdAt', filters);
    if (status) query.andWhere('application.status = :status', { status });
    const counts = await this.statusCounts(
      this.applicationRepo,
      'application',
      'application.createdAt',
      filters,
      ApplicationStatus,
      'application.property',
      status,
    );
    this.applyPaginationAndSort(query, 'application', filters, [
      'createdAt',
      'updatedAt',
      'status',
    ]);
    const [items, total] = await query.getManyAndCount();
    const today = new Date();
    return {
      counts,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      items: items.map((application) => ({
        ...application,
        pendingDays:
          application.status === ApplicationStatus.PENDING
            ? Math.max(
                0,
                Math.floor(
                  (today.getTime() - new Date(application.createdAt).getTime()) /
                    (24 * 60 * 60 * 1000),
                ),
              )
            : null,
      })),
    };
  }

  async getBilling(filters: ReportFilterDto) {
    const status = this.validateStatus(filters.status, InvoiceStatus);
    const query = this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.tenant', 'tenant')
      .leftJoinAndSelect('invoice.property', 'property')
      .leftJoinAndSelect('invoice.unit', 'unit');
    this.applyPropertyFilter(query, 'property', filters);
    this.applyDateFilter(query, 'invoice.createdAt', filters);
    this.applyInvoiceStatusFilter(query, status);

    const aggregate = this.invoiceRepo
      .createQueryBuilder('invoice')
      .select('COALESCE(SUM(invoice.totalAmount), 0)', 'billed')
      .addSelect('COALESCE(SUM(invoice.paidAmount), 0)', 'collected')
      .addSelect(
        'COALESCE(SUM(invoice.totalAmount - invoice.paidAmount), 0)',
        'outstanding',
      );
    this.applyPropertyFilter(aggregate, 'invoice.property', filters);
    this.applyDateFilter(aggregate, 'invoice.createdAt', filters);
    this.applyInvoiceStatusFilter(aggregate, status);
    const totals = await aggregate.getRawOne();

    const overdueQuery = this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.tenant', 'tenant')
      .leftJoinAndSelect('invoice.property', 'property')
      .leftJoinAndSelect('invoice.unit', 'unit')
      .where('invoice.dueDate < CURRENT_DATE')
      .andWhere('invoice.paidAmount < invoice.totalAmount');
    this.applyPropertyFilter(overdueQuery, 'invoice.property', filters);
    this.applyDateFilter(overdueQuery, 'invoice.createdAt', filters);
    this.applyInvoiceStatusFilter(overdueQuery, status);
    const overdueAmountQuery = this.invoiceRepo
      .createQueryBuilder('invoice')
      .select(
        'COALESCE(SUM(invoice.totalAmount - invoice.paidAmount), 0)',
        'amount',
      )
      .where('invoice.dueDate < CURRENT_DATE')
      .andWhere('invoice.paidAmount < invoice.totalAmount');
    this.applyPropertyFilter(overdueAmountQuery, 'invoice.property', filters);
    this.applyDateFilter(overdueAmountQuery, 'invoice.createdAt', filters);
    this.applyInvoiceStatusFilter(overdueAmountQuery, status);
    const [overdueCount, overdueTotals] = await Promise.all([
      overdueQuery.getCount(),
      overdueAmountQuery.getRawOne(),
    ]);
    overdueQuery
      .orderBy('invoice.dueDate', 'ASC')
      .skip(((filters.page || 1) - 1) * (filters.pageSize || REPORT_PAGE_SIZE_DEFAULT))
      .take(filters.pageSize || REPORT_PAGE_SIZE_DEFAULT);
    const overdueAccounts = await overdueQuery.getMany();

    this.applyPaginationAndSort(query, 'invoice', filters, [
      'createdAt',
      'updatedAt',
      'dueDate',
      'status',
    ]);
    const [items, total] = await query.getManyAndCount();
    const counts = await this.invoiceStatusCounts(filters, status);
    const [databaseDateRow] = await this.invoiceRepo.manager.query(
      'SELECT CURRENT_DATE AS today',
    );
    const databaseDate = String(databaseDateRow.today).slice(0, 10);
    return {
      counts,
      totals: {
        billed: Number(totals.billed),
        collected: Number(totals.collected),
        outstanding: Number(totals.outstanding),
        overdueCount,
        overdue: Number(overdueTotals.amount),
      },
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      items: items.map((invoice) => ({
        ...invoice,
        status: this.currentInvoiceStatus(invoice, databaseDate),
      })),
      overdueAccounts: overdueAccounts.map((invoice) => ({
        ...invoice,
        status: this.currentInvoiceStatus(invoice, databaseDate),
      })),
    };
  }

  async getMaintenance(filters: ReportFilterDto) {
    const status = this.validateStatus(filters.status, TicketStatus);
    const query = this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.reporter', 'reporter')
      .leftJoinAndSelect('ticket.property', 'property')
      .leftJoinAndSelect('ticket.unit', 'unit');
    this.applyPropertyFilter(query, 'property', filters);
    this.applyDateFilter(query, 'ticket.createdAt', filters);
    if (status) query.andWhere('ticket.status = :status', { status });

    const [counts, priorityCounts, staleCount, resolution] = await Promise.all([
      this.statusCounts(
        this.ticketRepo,
        'ticket',
        'ticket.createdAt',
        filters,
        TicketStatus,
        'ticket.property',
        status,
      ),
      this.groupCounts(
        this.ticketRepo,
        'ticket',
        'ticket.priority',
        filters,
        'ticket.property',
        'ticket.createdAt',
        status,
      ),
      this.staleTicketCount(filters, status),
      this.averageResolutionHours(filters, status),
    ]);
    this.applyPaginationAndSort(query, 'ticket', filters, [
      'createdAt',
      'updatedAt',
      'status',
      'title',
    ]);
    const [items, total] = await query.getManyAndCount();
    return {
      counts,
      priorityCounts,
      openCount:
        (counts[TicketStatus.OPEN] || 0) +
        (counts[TicketStatus.IN_PROGRESS] || 0),
      staleCount,
      averageResolutionHours: resolution,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      items,
    };
  }

  async getGigs(filters: ReportFilterDto) {
    const status = this.validateStatus(filters.status, GigStatus);
    const query = this.gigRepo
      .createQueryBuilder('gig')
      .leftJoinAndSelect('gig.postedBy', 'postedBy')
      .leftJoinAndSelect('gig.assignedTo', 'assignedTo');
    this.applyDateFilter(query, 'gig.createdAt', filters);
    if (status) query.andWhere('gig.status = :status', { status });

    const [counts, stalledCount] = await Promise.all([
      this.statusCounts(
        this.gigRepo,
        'gig',
        'gig.createdAt',
        filters,
        GigStatus,
        undefined,
        status,
      ),
      this.stalledGigCount(filters, status),
    ]);
    this.applyPaginationAndSort(query, 'gig', filters, [
      'createdAt',
      'updatedAt',
      'status',
      'title',
    ]);
    const [items, total] = await query.getManyAndCount();
    return {
      counts,
      activeCount: ACTIVE_GIG_STATUSES.reduce((sum, key) => sum + (counts[key] || 0), 0),
      completedCount: counts[GigStatus.COMPLETED] || 0,
      stalledCount,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      items,
    };
  }

  async getProperties(filters: ReportFilterDto) {
    const propertyIds = this.propertyIds(filters);
    const propertyQuery = this.propertyRepo
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.units', 'unit');
    if (propertyIds) propertyQuery.andWhere('property.id IN (:...propertyIds)', { propertyIds });
    const total = await propertyQuery.getCount();
    const page = filters.page || 1;
    const pageSize = filters.pageSize || REPORT_PAGE_SIZE_DEFAULT;
    this.applyPaginationAndSort(propertyQuery, 'property', filters, [
      'name',
      'createdAt',
      'updatedAt',
    ]);
    const properties = await propertyQuery.getMany();
    const ids = properties.map((property) => property.id);
    if (!ids.length) return { total, page, pageSize, items: [] };

    const [applications, invoices, tickets, gigs] = await Promise.all([
      this.propertyGroupedCounts(
        this.applicationRepo,
        'application',
        'application.property',
        'application.createdAt',
        ids,
        filters,
      ),
      this.propertyInvoiceTotals(ids, filters),
      this.propertyGroupedCounts(
        this.ticketRepo,
        'ticket',
        'ticket.property',
        'ticket.createdAt',
        ids,
        filters,
      ),
      this.propertyGroupedCounts(
        this.gigRepo,
        'gig',
        null,
        'gig.createdAt',
        ids,
        filters,
      ),
    ]);

    return {
      total,
      page,
      pageSize,
      items: properties.map((property) => {
        const units = property.units || [];
        const capacity = units.reduce((sum, unit) => sum + Number(unit.capacity || 0), 0);
        const occupied = units.reduce(
          (sum, unit) => sum + Number(unit.occupiedCount || 0),
          0,
        );
        const occupancyPercent = capacity ? (occupied / capacity) * 100 : 0;
        return {
          id: property.id,
          name: property.name,
          type: property.type,
          units: units.length,
          capacity,
          occupied,
          occupancyPercent,
          applications: applications[property.id] || {},
          billing: invoices[property.id] || { billed: 0, collected: 0, outstanding: 0 },
          maintenance: tickets[property.id] || {},
          gigs: gigs[property.id] || {},
        };
      }),
    };
  }

  async getAttention(filters: ReportFilterDto) {
    const applicationQuery = this.applicationRepo
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.applicant', 'applicant')
      .leftJoinAndSelect('application.property', 'property')
      .where('application.status = :status', { status: ApplicationStatus.PENDING })
      .andWhere(
        "application.createdAt < CURRENT_TIMESTAMP - (:days * INTERVAL '1 day')",
        { days: REPORT_THRESHOLDS.pendingApplicationDays },
      );
    this.applyPropertyFilter(applicationQuery, 'property', filters);
    this.applyDateFilter(applicationQuery, 'application.createdAt', filters);

    const invoiceQuery = this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.tenant', 'tenant')
      .leftJoinAndSelect('invoice.property', 'property')
      .where('invoice.dueDate < CURRENT_DATE')
      .andWhere('invoice.paidAmount < invoice.totalAmount');
    this.applyPropertyFilter(invoiceQuery, 'property', filters);
    this.applyDateFilter(invoiceQuery, 'invoice.createdAt', filters);

    const ticketQuery = this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.property', 'property')
      .where('ticket.status IN (:...statuses)', { statuses: ACTIVE_TICKET_STATUSES })
      .andWhere(
        "ticket.createdAt < CURRENT_TIMESTAMP - (:days * INTERVAL '1 day')",
        { days: REPORT_THRESHOLDS.staleMaintenanceDays },
      );
    this.applyPropertyFilter(ticketQuery, 'property', filters);
    this.applyDateFilter(ticketQuery, 'ticket.createdAt', filters);

    const gigQuery = this.gigRepo
      .createQueryBuilder('gig')
      .leftJoinAndSelect('gig.postedBy', 'postedBy')
      .where('gig.status IN (:...statuses)', { statuses: ACTIVE_GIG_STATUSES })
      .andWhere(
        "gig.updatedAt < CURRENT_TIMESTAMP - (:days * INTERVAL '1 day')",
        { days: REPORT_THRESHOLDS.stalledGigDays },
      );
    this.applyDateFilter(gigQuery, 'gig.createdAt', filters);

    const [applications, invoices, tickets, gigs, properties] = await Promise.all([
      applicationQuery.orderBy('application.createdAt', 'ASC').getMany(),
      invoiceQuery.orderBy('invoice.dueDate', 'ASC').getMany(),
      ticketQuery.orderBy('ticket.createdAt', 'ASC').getMany(),
      gigQuery.orderBy('gig.createdAt', 'ASC').getMany(),
      this.propertyAttentionRows(filters),
    ]);

    const alerts = [
      ...applications.map((item) => ({
        type: 'pending_application',
        severity: 'medium',
        createdAt: item.createdAt,
        title: `Pending application: ${item.property.name}`,
        detail: `${item.applicant.fullName} — ${this.daysSince(item.createdAt)} days pending`,
        propertyId: item.property.id,
        recordId: item.id,
      })),
      ...invoices.map((item) => ({
        type: 'overdue_invoice',
        severity: 'high',
        createdAt: item.dueDate,
        title: `Overdue invoice: ${item.invoiceNumber}`,
        detail: `${item.tenant.fullName} — ${Number(item.totalAmount) - Number(item.paidAmount)} outstanding`,
        propertyId: item.property.id,
        recordId: item.id,
      })),
      ...tickets.map((item) => ({
        type: 'stale_maintenance',
        severity: item.priority === TicketPriority.URGENT ? 'critical' : 'high',
        createdAt: item.createdAt,
        title: `Stale maintenance: ${item.title}`,
        detail: `${item.status} for ${this.daysSince(item.createdAt)} days`,
        propertyId: item.property.id,
        recordId: item.id,
      })),
      ...gigs.map((item) => ({
        type: 'stalled_gig',
        severity: 'low',
        createdAt: item.updatedAt,
        title: `Stalled gig: ${item.title}`,
        detail: `${item.status} with no activity for ${this.daysSince(item.updatedAt)} days`,
        propertyId: null,
        recordId: item.id,
      })),
      ...properties
        .filter(
          (property) =>
            property.occupancyPercent >= REPORT_THRESHOLDS.highOccupancyPercent,
        )
        .map((property) => ({
          type: 'high_occupancy',
          severity: 'medium',
          createdAt: null,
          title: `High occupancy: ${property.name}`,
          detail: `${property.occupancyPercent.toFixed(1)}% occupied`,
          propertyId: property.id,
          recordId: property.id,
        })),
    ].sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return (rightTime - leftTime) * (filters.sortOrder === 'ASC' ? -1 : 1);
    });
    if (filters.sortBy && filters.sortBy !== 'createdAt') {
      throw new BadRequestException('The attention report can only be sorted by createdAt');
    }

    const page = filters.page || 1;
    const pageSize = filters.pageSize || REPORT_PAGE_SIZE_DEFAULT;
    return {
      total: alerts.length,
      page,
      pageSize,
      items: alerts.slice((page - 1) * pageSize, page * pageSize),
    };
  }

  private async applicationSummary(filters: ReportFilterDto) {
    const counts = await this.statusCounts(
      this.applicationRepo,
      'application',
      'application.createdAt',
      filters,
      ApplicationStatus,
      'application.property',
    );
    return { total: Object.values(counts).reduce((sum, count) => sum + count, 0), pending: counts.pending || 0, counts };
  }

  private async billingSummary(filters: ReportFilterDto) {
    const query = this.invoiceRepo
      .createQueryBuilder('invoice')
      .select('COALESCE(SUM(invoice.totalAmount - invoice.paidAmount), 0)', 'outstanding')
      .addSelect('COUNT(invoice.id)', 'total');
    this.applyPropertyFilter(query, 'invoice.property', filters);
    this.applyDateFilter(query, 'invoice.createdAt', filters);
    const [totals, overdueCount] = await Promise.all([
      query.getRawOne(),
      this.staleInvoiceCount(filters),
    ]);
    return { total: Number(totals.total), outstanding: Number(totals.outstanding), overdueCount };
  }

  private async maintenanceSummary(filters: ReportFilterDto) {
    const counts = await this.statusCounts(
      this.ticketRepo,
      'ticket',
      'ticket.createdAt',
      filters,
      TicketStatus,
      'ticket.property',
    );
    const staleCount = await this.staleTicketCount(filters);
    return {
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      open: (counts.open || 0) + (counts.in_progress || 0),
      staleCount,
      counts,
    };
  }

  private async gigSummary(filters: ReportFilterDto) {
    const counts = await this.statusCounts(
      this.gigRepo,
      'gig',
      'gig.createdAt',
      filters,
      GigStatus,
    );
    return {
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      active: ACTIVE_GIG_STATUSES.reduce((sum, key) => sum + (counts[key] || 0), 0),
      stalledCount: await this.stalledGigCount(filters),
      counts,
    };
  }

  private async staleInvoiceCount(filters: ReportFilterDto): Promise<number> {
    const query = this.invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.dueDate < CURRENT_DATE')
      .andWhere('invoice.paidAmount < invoice.totalAmount');
    this.applyPropertyFilter(query, 'invoice.property', filters);
    this.applyDateFilter(query, 'invoice.createdAt', filters);
    return query.getCount();
  }

  private async invoiceStatusCounts(
    filters: ReportFilterDto,
    status?: string,
  ): Promise<Record<string, number>> {
    const statusExpression = `CASE
      WHEN invoice.totalAmount > 0 AND invoice.paidAmount >= invoice.totalAmount THEN '${InvoiceStatus.PAID}'
      WHEN invoice.dueDate < CURRENT_DATE AND invoice.paidAmount < invoice.totalAmount THEN '${InvoiceStatus.OVERDUE}'
      WHEN invoice.paidAmount > 0 AND invoice.paidAmount < invoice.totalAmount THEN '${InvoiceStatus.PARTIALLY_PAID}'
      ELSE '${InvoiceStatus.UNPAID}'
    END`;
    const query = this.invoiceRepo
      .createQueryBuilder('invoice')
      .select(statusExpression, 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy(statusExpression);
    this.applyPropertyFilter(query, 'invoice.property', filters);
    this.applyDateFilter(query, 'invoice.createdAt', filters);
    if (status) this.applyInvoiceStatusFilter(query, status);
    const rows = await query.getRawMany();
    const counts: Record<string, number> = Object.fromEntries(
      Object.values(InvoiceStatus).map((value) => [value, 0]),
    );
    rows.forEach((row: { status: string; count: string }) => {
      counts[row.status] = Number(row.count);
    });
    return counts;
  }

  private applyInvoiceStatusFilter<T>(
    query: SelectQueryBuilder<T>,
    status?: string,
  ): void {
    if (!status) return;
    if (status === InvoiceStatus.PAID) {
      query.andWhere('invoice.totalAmount > 0 AND invoice.paidAmount >= invoice.totalAmount');
    } else if (status === InvoiceStatus.OVERDUE) {
      query.andWhere('invoice.dueDate < CURRENT_DATE AND invoice.paidAmount < invoice.totalAmount');
    } else if (status === InvoiceStatus.PARTIALLY_PAID) {
      query.andWhere(
        'invoice.paidAmount > 0 AND invoice.paidAmount < invoice.totalAmount AND invoice.dueDate >= CURRENT_DATE',
      );
    } else {
      query.andWhere(
        'invoice.paidAmount = 0 AND invoice.dueDate >= CURRENT_DATE',
      );
    }
  }

  private currentInvoiceStatus(invoice: Invoice, currentDate: string): InvoiceStatus {
    const totalAmount = Number(invoice.totalAmount);
    const paidAmount = Number(invoice.paidAmount);
    const dueDate = String(invoice.dueDate).slice(0, 10);

    if (totalAmount > 0 && paidAmount >= totalAmount) return InvoiceStatus.PAID;
    if (dueDate < currentDate && paidAmount < totalAmount) return InvoiceStatus.OVERDUE;
    if (paidAmount > 0) return InvoiceStatus.PARTIALLY_PAID;
    return InvoiceStatus.UNPAID;
  }

  private async staleTicketCount(
    filters: ReportFilterDto,
    status?: string,
  ): Promise<number> {
    if (status && !ACTIVE_TICKET_STATUSES.includes(status as TicketStatus)) return 0;
    const query = this.ticketRepo
      .createQueryBuilder('ticket')
      .where('ticket.status IN (:...statuses)', {
        statuses: status ? [status] : ACTIVE_TICKET_STATUSES,
      })
      .andWhere(
        "ticket.createdAt < CURRENT_TIMESTAMP - (:days * INTERVAL '1 day')",
        { days: REPORT_THRESHOLDS.staleMaintenanceDays },
      );
    this.applyPropertyFilter(query, 'ticket.property', filters);
    this.applyDateFilter(query, 'ticket.createdAt', filters);
    return query.getCount();
  }

  private async stalledGigCount(filters: ReportFilterDto, status?: string): Promise<number> {
    if (status && !ACTIVE_GIG_STATUSES.includes(status as GigStatus)) return 0;
    const query = this.gigRepo
      .createQueryBuilder('gig')
      .where(status ? 'gig.status = :status' : 'gig.status IN (:...statuses)', {
        status,
        statuses: ACTIVE_GIG_STATUSES,
      })
      .andWhere(
        "gig.updatedAt < CURRENT_TIMESTAMP - (:days * INTERVAL '1 day')",
        { days: REPORT_THRESHOLDS.stalledGigDays },
      );
    this.applyDateFilter(query, 'gig.createdAt', filters);
    return query.getCount();
  }

  private async averageResolutionHours(
    filters: ReportFilterDto,
    status?: string,
  ): Promise<number> {
    const query = this.ticketRepo
      .createQueryBuilder('ticket')
      .select(
        'COALESCE(AVG(EXTRACT(EPOCH FROM (ticket.resolvedAt - ticket.createdAt)) / 3600), 0)',
        'average',
      )
      .where('ticket.resolvedAt IS NOT NULL');
    this.applyPropertyFilter(query, 'ticket.property', filters);
    this.applyDateFilter(query, 'ticket.createdAt', filters);
    if (status) query.andWhere('ticket.status = :status', { status });
    const result = await query.getRawOne();
    return Number(Number(result.average).toFixed(2));
  }

  private async statusCounts<T extends ReportEntity>(
    repository: Repository<T>,
    alias: string,
    dateColumn: string,
    filters: ReportFilterDto,
    statuses: object,
    propertyRelation?: string,
    status?: string,
  ): Promise<Record<string, number>> {
    const query = repository
      .createQueryBuilder(alias)
      .select(`${alias}.status`, 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy(`${alias}.status`);
    if (propertyRelation) this.applyPropertyFilter(query, propertyRelation, filters);
    this.applyDateFilter(query, dateColumn, filters);
    if (status) query.andWhere(`${alias}.status = :status`, { status });
    const rows = await query.getRawMany();
    const initialCounts = Object.fromEntries(
      rows.map((row: { status: string; count: string }) => [
        row.status,
        Number(row.count),
      ]),
    ) as Record<string, number>;
    return Object.values(statuses).reduce<Record<string, number>>(
      (counts, value) => {
        counts[String(value)] ??= 0;
        return counts;
      },
      initialCounts,
    );
  }

  private async groupCounts<T extends ReportEntity>(
    repository: Repository<T>,
    alias: string,
    column: string,
    filters: ReportFilterDto,
    propertyRelation: string,
    dateColumn: string,
    status?: string,
  ): Promise<Record<string, number>> {
    const query = repository
      .createQueryBuilder(alias)
      .select(column, 'key')
      .addSelect('COUNT(*)', 'count')
      .groupBy(column);
    this.applyPropertyFilter(query, propertyRelation, filters);
    this.applyDateFilter(query, dateColumn, filters);
    if (status) query.andWhere(`${alias}.status = :status`, { status });
    const rows = await query.getRawMany();
    return Object.fromEntries(rows.map((row) => [row.key, Number(row.count)]));
  }

  private async propertyGroupedCounts<T extends ReportEntity>(
    repository: Repository<T>,
    alias: string,
    propertyRelation: string | null,
    dateColumn: string,
    propertyIds: string[],
    filters: ReportFilterDto,
  ): Promise<Record<string, Record<string, number>>> {
    if (!propertyRelation) return {};
    const query = repository
      .createQueryBuilder(alias)
      .innerJoin(propertyRelation, 'property')
      .select('property.id', 'propertyId')
      .addSelect(`${alias}.status`, 'status')
      .addSelect('COUNT(*)', 'count')
      .where('property.id IN (:...propertyIds)', { propertyIds })
      .groupBy('property.id')
      .addGroupBy(`${alias}.status`);
    this.applyDateFilter(query, dateColumn, filters);
    const rows = await query.getRawMany();
    return rows.reduce((result, row) => {
      result[row.propertyId] ||= {};
      result[row.propertyId][row.status] = Number(row.count);
      return result;
    }, {} as Record<string, Record<string, number>>);
  }

  private async propertyInvoiceTotals(
    propertyIds: string[],
    filters: ReportFilterDto,
  ): Promise<Record<string, { billed: number; collected: number; outstanding: number }>> {
    const query = this.invoiceRepo
      .createQueryBuilder('invoice')
      .innerJoin('invoice.property', 'property')
      .select('property.id', 'propertyId')
      .addSelect('COALESCE(SUM(invoice.totalAmount), 0)', 'billed')
      .addSelect('COALESCE(SUM(invoice.paidAmount), 0)', 'collected')
      .addSelect('COALESCE(SUM(invoice.totalAmount - invoice.paidAmount), 0)', 'outstanding')
      .where('property.id IN (:...propertyIds)', { propertyIds })
      .groupBy('property.id');
    this.applyDateFilter(query, 'invoice.createdAt', filters);
    const rows = await query.getRawMany();
    return Object.fromEntries(
      rows.map((row) => [
        row.propertyId,
        {
          billed: Number(row.billed),
          collected: Number(row.collected),
          outstanding: Number(row.outstanding),
        },
      ]),
    );
  }

  private async propertyAttentionRows(filters: ReportFilterDto) {
    const query = this.propertyRepo
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.units', 'unit')
      .orderBy('property.name', 'ASC');
    const propertyIds = this.propertyIds(filters);
    if (propertyIds?.length === 1) {
      query.andWhere('property.id = :propertyId', { propertyId: propertyIds[0] });
    } else if (propertyIds?.length) {
      query.andWhere('property.id IN (:...propertyIds)', { propertyIds });
    }
    const properties = await query.getMany();
    return properties.map((property) => {
      const capacity = (property.units || []).reduce(
        (sum, unit) => sum + Number(unit.capacity || 0),
        0,
      );
      const occupied = (property.units || []).reduce(
        (sum, unit) => sum + Number(unit.occupiedCount || 0),
        0,
      );
      return {
        id: property.id,
        name: property.name,
        occupancyPercent: capacity ? (occupied / capacity) * 100 : 0,
      };
    });
  }

  private validateStatus<T extends object>(status: string | undefined, values: T): string | undefined {
    if (!status) return undefined;
    if (!Object.values(values).includes(status)) {
      throw new BadRequestException(
        `Invalid status '${status}'. Allowed values: ${Object.values(values).join(', ')}`,
      );
    }
    return status;
  }

  private applyPropertyFilter<T>(
    query: SelectQueryBuilder<T>,
    relation: string,
    filters: ReportFilterDto,
  ): void {
    const ids = this.propertyIds(filters);
    let propertyAlias = relation;
    if (relation.includes('.')) {
      propertyAlias = 'reportProperty';
      query.leftJoin(relation, propertyAlias);
    }
    if (ids?.length === 1) {
      query.andWhere(`${propertyAlias}.id = :propertyId`, { propertyId: ids[0] });
    } else if (ids?.length) {
      query.andWhere(`${propertyAlias}.id IN (:...propertyIds)`, { propertyIds: ids });
    }
  }

  private propertyIds(filters: ReportFilterDto): string[] | undefined {
    const ids = [...(filters.propertyIds || []), ...(filters.propertyId ? [filters.propertyId] : [])];
    const uniqueIds = [...new Set(ids)];
    return uniqueIds.length ? uniqueIds : undefined;
  }

  private applyDateFilter<T>(
    query: SelectQueryBuilder<T>,
    column: string,
    filters: ReportFilterDto,
  ): void {
    if (filters.dateFrom) {
      query.andWhere(`${column} >= CAST(:dateFrom AS DATE)`, {
        dateFrom: filters.dateFrom,
      });
    }
    if (filters.dateTo) {
      const endExclusive = new Date(`${filters.dateTo}T00:00:00.000Z`);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      query.andWhere(`${column} < CAST(:dateToExclusive AS DATE)`, {
        dateToExclusive: endExclusive.toISOString().slice(0, 10),
      });
    }
  }

  private applyPaginationAndSort<T>(
    query: SelectQueryBuilder<T>,
    alias: string,
    filters: ReportFilterDto,
    allowedSorts: string[],
  ): void {
    const sortBy = filters.sortBy || 'createdAt';
    if (!allowedSorts.includes(sortBy)) {
      throw new BadRequestException(
        `Invalid sortBy '${sortBy}'. Allowed values: ${allowedSorts.join(', ')}`,
      );
    }
    const page = filters.page || 1;
    const pageSize = filters.pageSize || REPORT_PAGE_SIZE_DEFAULT;
    query.orderBy(`${alias}.${sortBy}`, filters.sortOrder === 'ASC' ? 'ASC' : 'DESC');
    query.skip((page - 1) * pageSize).take(pageSize);
  }

  private daysSince(value: Date): number {
    return Math.max(
      0,
      Math.floor((Date.now() - new Date(value).getTime()) / (24 * 60 * 60 * 1000)),
    );
  }
}
