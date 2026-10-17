import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaintenanceTicket, OutageReport, TicketStatus } from './entities/ticket.entity';
import { CreateOutageReportDto, CreateTicketDto, UpdateTicketStatusDto } from './dto/maintenance.dto';
import { User } from '../users/entities/user.entity';
import { HousingService } from '../housing/housing.service';


const LONG_PENDING_DAYS = 3;
const OVERDUE_DAYS = 7;

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceTicket)
    private readonly ticketRepo: Repository<MaintenanceTicket>,
    @InjectRepository(OutageReport)
    private readonly outageRepo: Repository<OutageReport>,
    private readonly housingService: HousingService,
  ) {}

  async findAllTickets(reporterId?: string): Promise<MaintenanceTicket[]> {
    const qb = this.ticketRepo.createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.reporter', 'reporter')
      .leftJoinAndSelect('ticket.property', 'property')
      .leftJoinAndSelect('ticket.unit', 'unit')
      .orderBy('ticket.createdAt', 'DESC');

    if (reporterId) {
      qb.andWhere('reporter.id = :reporterId', { reporterId });
    }

    return qb.getMany();
  }

 async getAdminMaintenanceReport(filters: {
    startDate?: string;
    endDate?: string;
    propertyId?: string;
  }) {
    const qb = this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.reporter', 'reporter')
      .leftJoinAndSelect('ticket.property', 'property')
      .leftJoinAndSelect('ticket.unit', 'unit')
      .orderBy('ticket.createdAt', 'DESC');

    // All statuses are included. The report is based on the full matching ticket
    // history, not just unresolved tickets or the tickets shown on the current page.
    if (filters.startDate) {
      qb.andWhere('ticket.createdAt >= :startDate', {
        startDate: new Date(`${filters.startDate}T00:00:00.000Z`),
      });
    }
    if (filters.endDate) {
      const endExclusive = new Date(`${filters.endDate}T00:00:00.000Z`);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      qb.andWhere('ticket.createdAt < :endExclusive', { endExclusive });
    }
    if (filters.propertyId) {
      qb.andWhere('property.id = :propertyId', { propertyId: filters.propertyId });
    }

    const [tickets, properties] = await Promise.all([
      qb.getMany(),
      this.housingService.findAllProperties(),
    ]);
    const now = Date.now();
    const isPending = (ticket: MaintenanceTicket) =>
      ticket.status === TicketStatus.OPEN || ticket.status === TicketStatus.IN_PROGRESS;
    const ageInDays = (ticket: MaintenanceTicket) =>
      Math.max(0, Math.floor((now - new Date(ticket.createdAt).getTime()) / 86400000));

    const reportTickets = tickets.map((ticket) => {
      const pending = isPending(ticket);
      const ageDays = ageInDays(ticket);
      return {
        ...ticket,
        ageDays,
        isOverdue: pending && ageDays >= OVERDUE_DAYS,
        needsEscalation: pending && ageDays >= LONG_PENDING_DAYS,
      };
    });

    const countBy = (keyFn: (ticket: MaintenanceTicket) => string) => {
      const counts = new Map<string, number>();
      for (const ticket of tickets) {
        const key = keyFn(ticket) || 'Unknown';
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      return Array.from(counts, ([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    };

    // Monthly volume includes every status in the selected history.
    const monthlyCounts = new Map<string, number>();
    for (const ticket of tickets) {
      const date = new Date(ticket.createdAt);
      const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      monthlyCounts.set(monthKey, (monthlyCounts.get(monthKey) || 0) + 1);
    }
    const monthlyTrend = Array.from(monthlyCounts, ([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      generatedAt: new Date().toISOString(),
      thresholds: { longPendingDays: LONG_PENDING_DAYS, overdueDays: OVERDUE_DAYS },
      filters,
      summary: {
        total: reportTickets.length,
        open: reportTickets.filter((ticket) => isPending(ticket)).length,
        overdue: reportTickets.filter((ticket) => ticket.isOverdue).length,
        resolved: reportTickets.filter((ticket) =>
          ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED,
        ).length,
        needsEscalation: reportTickets.filter((ticket) => ticket.needsEscalation).length,
      },
      properties: properties.map((property) => ({ id: property.id, name: property.name })),
      volumeByProperty: countBy((ticket) => ticket.property?.name || 'Unknown property'),
      volumeByCategory: countBy((ticket) => ticket.category),
      monthlyTrend,
      tickets: reportTickets,
    };
  }

  async findTicketById(id: string): Promise<MaintenanceTicket> {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: ['reporter', 'property', 'unit'],
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }
    return ticket;
  }

  async createTicket(dto: CreateTicketDto, reporter: User): Promise<MaintenanceTicket> {
    const property = await this.housingService.findPropertyById(dto.propertyId);
    const ticket = this.ticketRepo.create({
      title: dto.title,
      description: dto.description,
      category: dto.category,
      priority: dto.priority,
      photoUrls: dto.photoUrls || [],
      reporter,
      property,
      status: TicketStatus.OPEN,
    });
    return this.ticketRepo.save(ticket);
  }

  async updateTicketStatus(id: string, dto: UpdateTicketStatusDto): Promise<MaintenanceTicket> {
    const ticket = await this.findTicketById(id);
    ticket.status = dto.status;
    if (dto.resolutionNotes) {
      ticket.resolutionNotes = dto.resolutionNotes;
    }
    if (dto.status === TicketStatus.RESOLVED || dto.status === TicketStatus.CLOSED) {
      ticket.resolvedAt = new Date();
    }
    return this.ticketRepo.save(ticket);
  }

  // Outage status tracking
  async findActiveOutages(): Promise<OutageReport[]> {
    return this.outageRepo.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async createOutage(dto: CreateOutageReportDto, reportedBy: User): Promise<OutageReport> {
    const outage = this.outageRepo.create({
      utilityType: dto.utilityType,
      affectedArea: dto.affectedArea,
      message: dto.message,
      estimatedRestoration: dto.estimatedRestoration ? new Date(dto.estimatedRestoration) : undefined,
      reportedBy,
      isActive: true,
    });
    return this.outageRepo.save(outage);
  }
}
