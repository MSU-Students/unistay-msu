import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property, Unit } from './entities/property.entity';
import { Application, ApplicationStatus, Lease } from './entities/application.entity';
import { CreateApplicationDto, CreatePropertyDto } from './dto/housing.dto';
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

  async findInvoiceProperties(manager: User): Promise<Property[]> {
    const query = this.propertyRepo
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.units', 'units')
      .leftJoinAndSelect('property.manager', 'manager');

    if (manager.role !== Role.UNIVERSITY_ADMIN) {
      query.where('manager.id = :managerId', { managerId: manager.id });
    }

    return query.getMany();
  }

  async findInvoiceTenants(
    propertyId: string,
    manager: User,
  ): Promise<
    {
      tenant: { id: string; fullName: string };
      units: { id: string; roomNumber: string; monthlyRate: number }[];
    }[]
  > {
    await this.findInvoiceProperty(propertyId, manager);
    const leases = await this.findActiveInvoiceLeases(propertyId);
    const tenants = new Map<
      string,
      {
        tenant: { id: string; fullName: string };
        units: { id: string; roomNumber: string; monthlyRate: number }[];
      }
    >();

    for (const lease of leases) {
      const option = tenants.get(lease.tenant.id) ?? {
        tenant: {
          id: lease.tenant.id,
          fullName: lease.tenant.fullName,
        },
        units: [],
      };
      if (!option.units.some((unit) => unit.id === lease.unit.id)) {
        option.units.push({
          id: lease.unit.id,
          roomNumber: lease.unit.roomNumber,
          monthlyRate: Number(lease.monthlyRate),
        });
      }
      tenants.set(lease.tenant.id, option);
    }

    return [...tenants.values()];
  }

  async findInvoiceParties(
    propertyId: string,
    tenantId: string,
    unitId: string | undefined,
    manager: User,
  ): Promise<{ tenant: User; property: Property; unit?: Unit }> {
    const property = await this.findInvoiceProperty(propertyId, manager);
    const matchingLease = (await this.findActiveInvoiceLeases(propertyId)).find(
      (lease) =>
        lease.tenant.id === tenantId &&
        (!unitId || lease.unit.id === unitId),
    );

    if (!matchingLease) {
      throw new BadRequestException(
        'The selected tenant and unit must belong to an active lease at this property.',
      );
    }

    return {
      tenant: matchingLease.tenant,
      property,
      unit: unitId ? matchingLease.unit : undefined,
    };
  }

  private async findInvoiceProperty(
    propertyId: string,
    manager: User,
  ): Promise<Property> {
    const property = await this.findPropertyById(propertyId);
    if (
      manager.role !== Role.UNIVERSITY_ADMIN &&
      property.manager?.id !== manager.id
    ) {
      throw new ForbiddenException(
        'You are not authorized to create invoices for this property.',
      );
    }
    return property;
  }

  private findActiveInvoiceLeases(propertyId: string): Promise<Lease[]> {
    return this.leaseRepo
      .createQueryBuilder('lease')
      .innerJoinAndSelect('lease.tenant', 'tenant')
      .innerJoinAndSelect('lease.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .where('lease.isActive = :isActive', { isActive: true })
      .andWhere('tenant.role = :tenantRole', { tenantRole: Role.STUDENT })
      .andWhere('tenant.isActive = :tenantActive', { tenantActive: true })
      .andWhere('property.id = :propertyId', { propertyId })
      .getMany();
  }

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

  async updateApplicationStatus(id: string, status: ApplicationStatus): Promise<Application> {
    const application = await this.applicationRepo.findOne({ where: { id } });
    if (!application) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }
    application.status = status;
    return this.applicationRepo.save(application);
  }
}
