import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import {
  CreateApplicationDto,
  CreatePropertyDto,
  UpdatePropertyDto,
import {
  Application,
  ApplicationStatus,
  Lease,
} from './entities/application.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class HousingService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Lease)
    private readonly leaseRepo: Repository<Lease>,
  ) {}

  async findAllProperties(
    query?: { type?: string; maxPrice?: number },
  ): Promise<Property[]> {
    const qb = this.propertyRepo
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.units', 'units')
      .leftJoinAndSelect('property.manager', 'manager');

    if (query?.type) {
      qb.andWhere('property.type = :type', { type: query.type });
    }

    if (query?.maxPrice) {
      qb.andWhere('property.minMonthlyRate <= :maxPrice', {
        maxPrice: query.maxPrice,
      });
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

  async findApplicationById(
    id: string,
    applicantId?: string,
  ): Promise<Application> {
    const application = await this.applicationRepo.findOne({
      where: { id },
      relations: ['applicant', 'property', 'unit'],
    });

    if (!application) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    if (applicantId && application.applicant.id !== applicantId) {
      throw new ForbiddenException(
        'Students can only access their own housing applications',
      );
    }

    return application;
  }

 
  async findPropertiesAssignedToManager(managerId: string): Promise<Property[]> {
    return this.propertyRepo.find({
      where: { manager: { id: managerId } },
      relations: ['units'],
      order: { name: 'ASC' },
    });
  }

  async findTenantsAssignedToManager(managerId: string): Promise<User[]> {
    const leases = await this.leaseRepo
      .createQueryBuilder('lease')
      .innerJoinAndSelect('lease.tenant', 'tenant')
      .innerJoin('lease.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .where('lease.isActive = :isActive', { isActive: true })
      .andWhere('property.managerId = :managerId', { managerId })
      .orderBy('tenant.fullName', 'ASC')
      .getMany();

    return Array.from(
      new Map(leases.map(({ tenant }) => [tenant.id, tenant])).values(),
    );
  }

  async isTenantAssignedToManager(
    tenantId: string,
    managerId: string,
  ): Promise<boolean> {
    const count = await this.leaseRepo
      .createQueryBuilder('lease')
      .innerJoin('lease.tenant', 'tenant')
      .innerJoin('lease.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .where('lease.isActive = :isActive', { isActive: true })
      .andWhere('tenant.id = :tenantId', { tenantId })
      .andWhere('property.managerId = :managerId', { managerId })
      .getCount();

    return count > 0;
  }

  async isTenantAssignedToProperty(
    tenantId: string,
    propertyId: string,
  ): Promise<boolean> {
    const count = await this.leaseRepo
      .createQueryBuilder('lease')
      .innerJoin('lease.tenant', 'tenant')
      .innerJoin('lease.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .where('lease.isActive = :isActive', { isActive: true })
      .andWhere('tenant.id = :tenantId', { tenantId })
      .andWhere('property.id = :propertyId', { propertyId })
      .getCount();

    return count > 0;
  }

  async findApplicationsForManager(managerId: string): Promise<Application[]> {
    return this.applicationRepo
      .createQueryBuilder('application')
      .innerJoinAndSelect('application.property', 'property')
      .leftJoinAndSelect('application.unit', 'unit')
      .leftJoinAndSelect('application.applicant', 'applicant')
      .where('property.managerId = :managerId', { managerId })
      .orderBy('application.createdAt', 'DESC')
      .getMany();
  }

  async assertPropertyAssignedToManager(
    propertyId: string,
    managerId: string,
  ): Promise<void> {
    const property = await this.propertyRepo.findOne({
      where: { id: propertyId, manager: { id: managerId } },
      select: { id: true },
    });

    if (!property) {
      throw new ForbiddenException(
        'You can only access your assigned properties',
      );
    }
  }

  async createProperty(
    dto: CreatePropertyDto,
    manager: User,
  ): Promise<Property> {
    const property = this.propertyRepo.create({
      ...dto,
      manager,
    });

    return this.propertyRepo.save(property);
  }

  
  async updateProperty(
    id: string,
    dto: UpdatePropertyDto,
  ): Promise<Property> {
    const property = await this.findPropertyById(id);

    Object.assign(property, dto);

    return this.propertyRepo.save(property);
  }


  async createApplication(dto: CreateApplicationDto, applicant: User): Promise<Application> {
    const property = await this.findPropertyById(dto.propertyId);

    const application = this.applicationRepo.create({
      applicant,
      property,
      remarks: dto.remarks,
      status: ApplicationStatus.PENDING,
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

  async findApplicationsForReview(user: User): Promise<Application[]> {
    const query = this.applicationRepo
      .createQueryBuilder('application')
      .leftJoin('application.applicant', 'applicant')
      .leftJoin('application.property', 'property')
      .leftJoin('application.unit', 'unit')
      .leftJoin('property.manager', 'manager')
      .select([
        'application.id',
        'application.status',
        'application.remarks',
        'application.createdAt',
        'applicant.id',
        'applicant.fullName',
        'applicant.email',
        'property.id',
        'property.name',
        'unit.id',
        'unit.roomNumber',
      ])
      .orderBy('application.createdAt', 'DESC');

    if (user.role === Role.PROPERTY_MANAGER) {
      query.andWhere('manager.id = :managerId', { managerId: user.id });
    }

    return query.getMany();
  }

  async updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    user: User,
  ): Promise<Application> {
    const application = await this.applicationRepo.findOne({
      where: { id },
      relations: ['property', 'property.manager'],
    });

    if (!application) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    if (
      user.role === Role.PROPERTY_MANAGER &&
      application.property.manager?.id !== user.id
    ) {
      throw new ForbiddenException(
        'You can only manage applications for your assigned properties',
      );
    }

    if (
      user.role !== Role.PROPERTY_MANAGER &&
      user.role !== Role.UNIVERSITY_ADMIN
    ) {
      throw new ForbiddenException(
        'You are not allowed to update application status',
      );
    }

    application.status = status;

    return this.applicationRepo.save(application);
  }
}
