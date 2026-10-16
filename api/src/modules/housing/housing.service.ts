import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { Application, ApplicationStatus } from './entities/application.entity';
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
    const qb = this.applicationRepo
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.applicant', 'applicant')
      .leftJoinAndSelect('application.property', 'property')
      .leftJoinAndSelect('application.unit', 'unit')
      .leftJoinAndSelect('property.manager', 'manager')
      .orderBy('application.createdAt', 'DESC');

    // Property managers can only review applications for their own properties.
    if (user.role === Role.PROPERTY_MANAGER) {
      qb.andWhere('manager.id = :managerId', {
        managerId: user.id,
      });
    }

    return qb.getMany();
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
      'You can only review applications for your own properties',
    );
  }

  application.status = status;
  return this.applicationRepo.save(application);
}
