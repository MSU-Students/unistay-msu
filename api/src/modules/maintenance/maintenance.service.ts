import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaintenanceTicket, OutageReport, TicketStatus } from './entities/ticket.entity';
import {
  CreateOutageReportDto,
  CreateTicketDto,
  UpdateTicketStatusDto,
  AssignMaintenanceTicketDto,
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

async findAllTickets(
  reporterId?: string,
  managerId?: string,
): Promise<MaintenanceTicket[]> {
  const qb = this.ticketRepo
    .createQueryBuilder('ticket')
    .leftJoinAndSelect('ticket.reporter', 'reporter')
    .leftJoinAndSelect('ticket.property', 'property')
    .leftJoinAndSelect('ticket.unit', 'unit')
    .leftJoin('property.manager', 'manager')
    .orderBy('ticket.createdAt', 'DESC');

  if (reporterId) {
    qb.andWhere('reporter.id = :reporterId', { reporterId });
  }

  if (managerId) {
    qb.andWhere('manager.id = :managerId', { managerId });
  }

  return qb.getMany();
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


async assignTicket(
  id: string,
  dto: AssignMaintenanceTicketDto,
): Promise<MaintenanceTicket> {
  const ticket = await this.findTicketById(id);

  if (dto.assignedTo !== undefined) {
    ticket.assignedTo = dto.assignedTo;
  }

  if (dto.vendorName !== undefined) {
    ticket.vendorName = dto.vendorName;
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
