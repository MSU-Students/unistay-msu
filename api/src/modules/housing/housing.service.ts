import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import {
  Application,
  ApplicationStatus,
  ApplicationStatusHistoryEntry,
} from './entities/application.entity';
import {
  AdminApplicationReportQueryDto,
  CreateApplicationDto,
  CreatePropertyDto,
  UpdateApplicationComplianceDto,
} from './dto/housing.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class HousingService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
  ) {}

  async findAllProperties(query?: { type?: string; maxPrice?: number }): Promise<Property[]> {
    const qb = this.propertyRepo.createQueryBuilder('property')
      .leftJoinAndSelect('property.units', 'units')
      .leftJoinAndSelect('property.manager', 'manager');

    if (query?.type) {
      qb.andWhere('property.type = :type', { type: query.type });
    }
    if (query?.maxPrice) {
      qb.andWhere('property.minMonthlyRate <= :maxPrice', { maxPrice: query.maxPrice });
    }

    return qb.getMany();
  }

  async findPropertyById(id: string): Promise<Property> {
    const property = await this.propertyRepo.findOne({
      where: { id },
      relations: ['units', 'manager'],
    });
    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }
    return property;
  }

  async createProperty(dto: CreatePropertyDto, manager: User): Promise<Property> {
    const property = this.propertyRepo.create({
      ...dto,
      manager,
    });
    return this.propertyRepo.save(property);
  }

  async createApplication(dto: CreateApplicationDto, applicant: User): Promise<Application> {
    const property = await this.findPropertyById(dto.propertyId);
    const application = this.applicationRepo.create({
      applicant,
      property,
      remarks: dto.remarks,
      status: ApplicationStatus.PENDING,
      statusHistory: [
        {
          status: ApplicationStatus.PENDING,
          changedAt: new Date().toISOString(),
          changedBy: applicant.id,
        },
      ],
    });
    return this.applicationRepo.save(application);
  }

  async findApplicationsByUser(user: User): Promise<Application[]> {
    return this.applicationRepo.find({
      where: { applicant: { id: user.id } },
      relations: ['property', 'unit'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    changedBy: User,
  ): Promise<Application> {
    const application = await this.applicationRepo.findOne({ where: { id } });
    if (!application) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }
    if (application.status !== status) {
      application.status = status;
      application.statusHistory = [
        ...(application.statusHistory || []),
        {
          status,
          changedAt: new Date().toISOString(),
          changedBy: changedBy.id,
        },
      ];
    }
    return this.applicationRepo.save(application);
  }

  async findAdminApplicationReport(filters: AdminApplicationReportQueryDto) {
    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      throw new BadRequestException('fromDate must be on or before toDate');
    }

    const query = this.applicationRepo
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.applicant', 'applicant')
      .leftJoinAndSelect('application.property', 'property')
      .leftJoinAndSelect('application.unit', 'unit')
      .orderBy('application.createdAt', 'DESC');

    if (filters.propertyId) {
      query.andWhere('property.id = :propertyId', { propertyId: filters.propertyId });
    }
    if (filters.status) {
      query.andWhere('application.status = :status', { status: filters.status });
    }
    if (filters.fromDate) {
      query.andWhere('application.createdAt >= :fromDate', {
        fromDate: new Date(`${filters.fromDate}T00:00:00.000Z`),
      });
    }
    if (filters.toDate) {
      const dayAfterToDate = new Date(`${filters.toDate}T00:00:00.000Z`);
      dayAfterToDate.setUTCDate(dayAfterToDate.getUTCDate() + 1);
      query.andWhere('application.createdAt < :dayAfterToDate', { dayAfterToDate });
    }

    const applications = await query.getMany();
    const count = (status: ApplicationStatus) =>
      applications.filter((application) => application.status === status).length;

    return {
      summary: {
        total: applications.length,
        pending: count(ApplicationStatus.PENDING),
        approved: count(ApplicationStatus.APPROVED),
        rejected: count(ApplicationStatus.REJECTED),
        cancelled: count(ApplicationStatus.CANCELLED),
        policyExceptions: applications.filter((application) => application.policyException).length,
        escalated: applications.filter((application) => application.escalated).length,
      },
      applications: applications.map((application) => ({
        id: application.id,
        status: application.status,
        statusHistory: application.statusHistory || [],
        policyException: application.policyException,
        policyExceptionReason: application.policyExceptionReason,
        escalated: application.escalated,
        escalationReason: application.escalationReason,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
        applicant: {
          id: application.applicant.id,
          fullName: application.applicant.fullName,
          studentIdNumber: application.applicant.studentIdNumber,
          college: application.applicant.college,
          course: application.applicant.course,
        },
        property: {
          id: application.property.id,
          name: application.property.name,
          address: application.property.address,
        },
        unit: application.unit
          ? { id: application.unit.id, roomNumber: application.unit.roomNumber }
          : null,
      })),
    };
  }

  async updateApplicationCompliance(
    id: string,
    dto: UpdateApplicationComplianceDto,
  ): Promise<Application> {
    const application = await this.applicationRepo.findOne({ where: { id } });
    if (!application) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    if (dto.policyException !== undefined) {
      application.policyException = dto.policyException;
      application.policyExceptionReason = dto.policyException
        ? dto.policyExceptionReason?.trim() || application.policyExceptionReason
        : null;
      if (dto.policyException && !application.policyExceptionReason) {
        throw new BadRequestException('A reason is required when flagging a policy exception');
      }
    } else if (dto.policyExceptionReason !== undefined) {
      const reason = dto.policyExceptionReason.trim();
      if (application.policyException && !reason) {
        throw new BadRequestException('A reason is required when a policy exception is flagged');
      }
      application.policyExceptionReason = reason || null;
    }

    if (dto.escalated !== undefined) {
      application.escalated = dto.escalated;
      application.escalationReason = dto.escalated
        ? dto.escalationReason?.trim() || application.escalationReason
        : null;
      if (dto.escalated && !application.escalationReason) {
        throw new BadRequestException('A reason is required when escalating an application');
      }
    } else if (dto.escalationReason !== undefined) {
      const reason = dto.escalationReason.trim();
      if (application.escalated && !reason) {
        throw new BadRequestException('A reason is required when an application is escalated');
      }
      application.escalationReason = reason || null;
    }

    return this.applicationRepo.save(application);
  }
}
