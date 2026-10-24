import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaintenanceTicket, OutageReport, TicketActivity, TicketStatus } from './entities/ticket.entity';
import {
  CreateOutageReportDto,
  CreateTicketDto,
  UpdateMaintenanceTicketDto,
  UpdateTicketStatusDto,
} from './dto/maintenance.dto';
import { User } from '../users/entities/user.entity';
import { HousingService } from '../housing/housing.service';

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
      .leftJoinAndSelect('ticket.activities', 'activities')
      .leftJoinAndSelect('activities.actor', 'activityActor')
      .orderBy('ticket.createdAt', 'DESC')
      .addOrderBy('activities.createdAt', 'ASC');

    if (reporterId) {
      qb.andWhere('reporter.id = :reporterId', { reporterId });
    }

    return qb.getMany();
  }

  async findTicketById(id: string): Promise<MaintenanceTicket> {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: ['reporter', 'property', 'unit', 'activities', 'activities.actor'],
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }
    ticket.activities?.sort(
      (first, second) => first.createdAt.getTime() - second.createdAt.getTime(),
    );
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
    return this.ticketRepo.manager.transaction(async (manager) => {
      const savedTicket = await manager.save(ticket);
      await manager.save(TicketActivity, {
        ticket: savedTicket,
        actor: reporter,
        note: 'Ticket submitted',
        status: TicketStatus.OPEN,
      });
      return savedTicket;
    });
  }

  async updateTicketStatus(
    id: string,
    dto: UpdateTicketStatusDto,
    actor: User,
  ): Promise<MaintenanceTicket> {
    return this.updateTicket(id, dto, actor);
  }

  async updateTicket(
    id: string,
    dto: UpdateMaintenanceTicketDto,
    actor: User,
  ): Promise<MaintenanceTicket> {
    const ticket = await this.findTicketById(id);
    const changed = dto.status !== undefined
      || dto.assignedToName !== undefined
      || dto.note !== undefined
      || dto.resolutionNotes !== undefined;
    if (!changed) {
      throw new BadRequestException('At least one ticket field must be updated.');
    }

    if (dto.status !== undefined) {
      ticket.status = dto.status;
    }
    if (dto.assignedToName !== undefined) {
      ticket.assignedToName = dto.assignedToName.trim() || undefined;
    }
    if (dto.resolutionNotes !== undefined) {
      ticket.resolutionNotes = dto.resolutionNotes;
    }
    if (
      dto.status === TicketStatus.RESOLVED
      || dto.status === TicketStatus.CLOSED
    ) {
      ticket.resolvedAt = ticket.resolvedAt || new Date();
    }

    await this.ticketRepo.manager.transaction(async (manager) => {
      await manager.save(ticket);
      await manager.save(TicketActivity, {
        ticket,
        actor,
        status: ticket.status,
        assignedToName: ticket.assignedToName,
        note: dto.note,
        resolutionNotes: dto.resolutionNotes,
      });
    });
    return this.findTicketById(id);
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
