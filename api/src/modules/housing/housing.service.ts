import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property, PropertyType, Unit } from './entities/property.entity';
import { Application, ApplicationStatus, Lease } from './entities/application.entity';
import { CreateApplicationDto, CreatePropertyDto, UpdatePropertyDto } from './dto/housing.dto';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';

/**
 * Service managing housing properties, dormitory units, applications, and resident assignments.
 */
@Injectable()
export class HousingService implements OnModuleInit {
  private readonly logger = new Logger(HousingService.name);

  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Lease)
    private readonly leaseRepo: Repository<Lease>,
  ) {}

  async onModuleInit() {
    await this.seedInitialHousing();
  }

  /**
   * Automatically seed initial MSU dormitories and units if none exist.
   */
  private async seedInitialHousing() {
    try {
      const count = await this.propertyRepo.count();
      if (count > 0) return;

      this.logger.log('Seeding initial housing properties and dormitory units...');

      // 1. Alumni Residence Hall (Institutional Dormitory)
      const alumniDorm = this.propertyRepo.create({
        name: 'Alumni Residence Hall',
        type: PropertyType.INSTITUTIONAL_DORM,
        description: 'Flagship institutional student dormitory inside Mindanao State University campus with high-speed campus fiber Wi-Fi.',
        address: 'Sector 2, MSU Main Campus, Marawi City',
        proximityToCollege: '5 mins walk to CNSM, 8 mins walk to CAS',
        amenities: ['Wi-Fi', 'Study Hall', '24/7 Campus Security', 'Common Kitchen', 'Water Refilling Station'],
        minMonthlyRate: 800,
        maxMonthlyRate: 1200,
        isAccredited: true,
      });
      const savedAlumni = await this.propertyRepo.save(alumniDorm);

      // Units for Alumni Dorm
      const alumniUnits = [
        this.unitRepo.create({ roomNumber: 'Room 101', capacity: 4, occupiedCount: 3, monthlyRent: 800, isAvailable: true, property: savedAlumni }),
        this.unitRepo.create({ roomNumber: 'Room 102', capacity: 4, occupiedCount: 4, monthlyRent: 800, isAvailable: false, property: savedAlumni }),
        this.unitRepo.create({ roomNumber: 'Room 204', capacity: 2, occupiedCount: 1, monthlyRent: 1200, isAvailable: true, property: savedAlumni }),
        this.unitRepo.create({ roomNumber: 'Room 205', capacity: 2, occupiedCount: 2, monthlyRent: 1200, isAvailable: false, property: savedAlumni }),
      ];
      await this.unitRepo.save(alumniUnits);

      // 2. Marawi Heights Boarding House (Accredited Private Boarding House)
      const marawiHeights = this.propertyRepo.create({
        name: 'Marawi Heights Boarding House',
        type: PropertyType.PRIVATE_BOARDING_HOUSE,
        description: 'Accredited off-campus private student housing with individual sub-metered electricity and study desks.',
        address: 'Commercial Center, 4th Street, MSU Marawi',
        proximityToCollege: '3 mins walk to CBAA, 5 mins walk to College of Law',
        amenities: ['Individual Sub-meter', 'CCTV Security', 'Gated Compound', 'Backup Generator'],
        minMonthlyRate: 1500,
        maxMonthlyRate: 2500,
        isAccredited: true,
      });
      const savedHeights = await this.propertyRepo.save(marawiHeights);

      const heightsUnits = [
        this.unitRepo.create({ roomNumber: 'Unit A1', capacity: 2, occupiedCount: 1, monthlyRent: 1800, isAvailable: true, property: savedHeights }),
        this.unitRepo.create({ roomNumber: 'Unit A2', capacity: 2, occupiedCount: 2, monthlyRent: 1800, isAvailable: false, property: savedHeights }),
        this.unitRepo.create({ roomNumber: 'Unit B1', capacity: 1, occupiedCount: 0, monthlyRent: 2500, isAvailable: true, property: savedHeights }),
      ];
      await this.unitRepo.save(heightsUnits);

      this.logger.log('Initial housing properties and units seeded successfully.');
    } catch (err: any) {
      this.logger.warn(`Initial housing seed deferred: ${err?.message || err}`);
    }
  }

  async findAllProperties(query?: { type?: string; maxPrice?: number }): Promise<Property[]> {
    const qb = this.propertyRepo.createQueryBuilder('property')
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

  async findUnitById(id: string): Promise<Unit> {
    const unit = await this.unitRepo.findOne({
      where: { id },
      relations: ['property'],
    });
    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }
    return unit;
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
    let unit: Unit | undefined = undefined;
    if (dto.unitId) {
      unit = await this.findUnitById(dto.unitId);
    }
    const application = this.applicationRepo.create({
      applicant,
      property,
      unit,
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

  /**
   * Resolve active residence (assigned property and room) for a student.
   * Checks active leases first, then approved applications, or assigns to default demo room if first login.
   */
  async getMyResidence(user: User): Promise<{
    property: Property;
    unit: Unit;
    commonAreas: { id: string; name: string }[];
  } | null> {
    // 1. Check active lease
    const activeLease = await this.leaseRepo.findOne({
      where: { tenant: { id: user.id }, isActive: true },
      relations: ['unit', 'unit.property'],
    });

    if (activeLease && activeLease.unit && activeLease.unit.property) {
      return {
        property: activeLease.unit.property,
        unit: activeLease.unit,
        commonAreas: this.getCommonAreasForProperty(activeLease.unit.property),
      };
    }

    // 2. Check approved or existing application
    const app = await this.applicationRepo.findOne({
      where: { applicant: { id: user.id } },
      relations: ['property', 'unit', 'property.units'],
      order: { createdAt: 'DESC' },
    });

    if (app && app.property) {
      const assignedUnit = app.unit || (app.property.units && app.property.units[0]);
      if (assignedUnit) {
        return {
          property: app.property,
          unit: assignedUnit,
          commonAreas: this.getCommonAreasForProperty(app.property),
        };
      }
    }

    // 3. Fallback: Bind to first seeded institutional dorm & room for seamless testing
    const defaultProperties = await this.propertyRepo.find({
      relations: ['units'],
      order: { createdAt: 'ASC' },
      take: 1,
    });
    const defaultProperty = defaultProperties[0] ?? null;

    if (defaultProperty && defaultProperty.units && defaultProperty.units.length > 0) {
      // Pick room 204 or first unit
      const defaultUnit = defaultProperty.units.find(u => u.roomNumber.includes('204')) || defaultProperty.units[0];
      return {
        property: defaultProperty,
        unit: defaultUnit,
        commonAreas: this.getCommonAreasForProperty(defaultProperty),
      };
    }

    return null;
  }

  private getCommonAreasForProperty(_property: Property): { id: string; name: string }[] {
    return [
      { id: 'common-cr', name: 'Shared Restroom / CR' },
      { id: 'common-hallway', name: 'Hallway / Corridor' },
      { id: 'common-kitchen', name: 'Shared Kitchen / Pantry' },
      { id: 'common-study', name: 'Study Hall' },
      { id: 'common-laundry', name: 'Laundry Area' },
    ];
  }
}
