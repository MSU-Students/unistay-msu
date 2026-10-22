import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property, PropertyStatus } from './entities/property.entity';
import { Application, ApplicationStatus } from './entities/application.entity';
import { CreateApplicationDto, CreatePropertyDto, UpdatePropertyDto } from './dto/housing.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class HousingService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
  ) {}

  private validateListing(dto: Partial<CreatePropertyDto | UpdatePropertyDto>): void {
    if (!dto.title || !String(dto.title).trim()) {
      throw new BadRequestException('Title is required');
    }
    if (!dto.address || !String(dto.address).trim()) {
      throw new BadRequestException('Address is required');
    }
    if (dto.price === undefined || dto.price === null || Number.isNaN(Number(dto.price)) || Number(dto.price) < 0) {
      throw new BadRequestException('Price is required and must be a non-negative number');
    }
  }

  private ensureOwner(property: Property, user: User): void {
    if (!property.manager || property.manager.id !== user.id) {
      throw new ForbiddenException('You are not allowed to edit or deactivate this listing');
    }
  }

  async findAllProperties(query?: { type?: string; maxPrice?: number }): Promise<Property[]> {
    const qb = this.propertyRepo.createQueryBuilder('property')
      .leftJoinAndSelect('property.units', 'units')
      .leftJoinAndSelect('property.manager', 'manager')
      .where('property.status = :status', { status: PropertyStatus.ACTIVE });

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
    this.validateListing(dto);

    const listing = this.propertyRepo.create({
      title: dto.title,
      name: dto.name || dto.title,
      address: dto.address,
      description: dto.description || '',
      type: dto.type || undefined,
      price: Number(dto.price),
      minMonthlyRate: Number(dto.minMonthlyRate ?? dto.price),
      maxMonthlyRate: Number(dto.maxMonthlyRate ?? dto.price),
      photos: dto.photos || [],
      unitDetails: dto.unitDetails,
      amenities: dto.amenities || [],
      status: PropertyStatus.ACTIVE,
      manager,
    });
    return this.propertyRepo.save(listing);
  }

  async updateProperty(id: string, dto: UpdatePropertyDto, user: User): Promise<Property> {
    const property = await this.propertyRepo.findOne({ where: { id }, relations: ['manager'] });
    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }
    this.ensureOwner(property, user);
    this.validateListing({ ...property, ...dto });

    const updateData = {
      title: dto.title ?? property.title ?? property.name,
      name: dto.name ?? dto.title ?? property.name ?? property.title,
      address: dto.address ?? property.address,
      description: dto.description ?? property.description,
      price: Number(dto.price ?? property.price ?? property.minMonthlyRate ?? 0),
      minMonthlyRate: Number(dto.minMonthlyRate ?? dto.price ?? property.minMonthlyRate ?? property.price ?? 0),
      maxMonthlyRate: Number(dto.maxMonthlyRate ?? dto.price ?? property.maxMonthlyRate ?? property.price ?? 0),
      photos: dto.photos ?? property.photos ?? [],
      unitDetails: dto.unitDetails ?? property.unitDetails,
      amenities: dto.amenities ?? property.amenities ?? [],
      type: dto.type ?? property.type,
      proximityToCollege: dto.proximityToCollege ?? property.proximityToCollege,
    };

    Object.assign(property, updateData);
    return this.propertyRepo.save(property);
  }

  async deactivateProperty(id: string, user: User): Promise<Property> {
    const property = await this.propertyRepo.findOne({ where: { id }, relations: ['manager'] });
    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }
    this.ensureOwner(property, user);
    property.status = PropertyStatus.INACTIVE;
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
