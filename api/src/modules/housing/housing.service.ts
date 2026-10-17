import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property, Unit } from './entities/property.entity';
import {
  Application,
  ApplicationAcademicDetails,
  ApplicationPersonalDetails,
  ApplicationStatus,
} from './entities/application.entity';
import {
  ApplicationAcademicDetailsDto,
  ApplicationPersonalDetailsDto,
  CreateApplicationDto,
  CreatePropertyDto,
  SaveApplicationDraftDto,
} from './dto/housing.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class HousingService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
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

  async submitApplication(dto: CreateApplicationDto, applicant: User): Promise<Application> {
    const details = this.getCompleteDetails(dto, applicant);
    const property = await this.findPropertyById(dto.propertyId);
    const unit = await this.findUnit(dto.unitId, property.id, true);
    return this.applicationRepo.save(this.applicationRepo.create({
      applicant,
      property,
      unit,
      remarks: dto.remarks,
      personalDetails: details.personalDetails,
      academicDetails: details.academicDetails,
      status: ApplicationStatus.PENDING,
      submittedAt: new Date(),
    }));
  }

  async saveApplicationDraft(
    dto: SaveApplicationDraftDto,
    applicant: User,
  ): Promise<Application> {
    const { property, unit } = await this.resolveHousingSelection(dto);
    return this.applicationRepo.save(this.applicationRepo.create({
      applicant,
      property,
      unit,
      remarks: dto.remarks,
      personalDetails: this.mergePersonalDetails(dto.personalDetails, applicant),
      academicDetails: this.mergeAcademicDetails(dto.academicDetails, applicant),
      status: ApplicationStatus.DRAFT,
    }));
  }

  async updateApplicationDraft(
    id: string,
    dto: SaveApplicationDraftDto,
    applicant: User,
  ): Promise<Application> {
    const application = await this.findOwnedApplication(id, applicant);
    this.ensureDraft(application);

    const { property, unit } = await this.resolveHousingSelection(dto, application);
    application.property = property;
    application.unit = unit;
    application.remarks = dto.remarks ?? application.remarks;
    application.personalDetails = this.mergePersonalDetails(
      dto.personalDetails,
      applicant,
      application.personalDetails,
    );
    application.academicDetails = this.mergeAcademicDetails(
      dto.academicDetails,
      applicant,
      application.academicDetails,
    );
    return this.applicationRepo.save(application);
  }

  async submitApplicationDraft(
    id: string,
    dto: SaveApplicationDraftDto,
    applicant: User,
  ): Promise<Application> {
    const application = await this.findOwnedApplication(id, applicant);
    this.ensureDraft(application);

    const { property, unit } = await this.resolveHousingSelection(dto, application, true);
    if (!property) {
      throw new BadRequestException('propertyId is required before submitting an application');
    }

    const details = this.getCompleteDetails({
      propertyId: property.id,
      personalDetails: {
        ...application.personalDetails,
        ...dto.personalDetails,
      },
      academicDetails: {
        ...application.academicDetails,
        ...dto.academicDetails,
      },
    }, applicant);

    application.property = property;
    application.unit = unit;
    application.remarks = dto.remarks ?? application.remarks;
    application.personalDetails = details.personalDetails;
    application.academicDetails = details.academicDetails;
    application.status = ApplicationStatus.PENDING;
    application.submittedAt = new Date();
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
    if (application.status === ApplicationStatus.DRAFT || status === ApplicationStatus.DRAFT) {
      throw new BadRequestException('Draft applications cannot be reviewed or changed through this endpoint');
    }
    application.status = status;
    return this.applicationRepo.save(application);
  }

  private getCompleteDetails(
    dto: Pick<CreateApplicationDto, 'personalDetails' | 'academicDetails'> & { propertyId?: string },
    applicant: User,
  ): { personalDetails: ApplicationPersonalDetails; academicDetails: ApplicationAcademicDetails } {
    const personalDetails = this.mergePersonalDetails(dto.personalDetails, applicant);
    const academicDetails = this.mergeAcademicDetails(dto.academicDetails, applicant);
    const missingFields: string[] = [];

    if (!personalDetails.fullName.trim()) missingFields.push('fullName');
    if (!personalDetails.email.trim()) missingFields.push('email');
    if (!personalDetails.studentIdNumber?.trim()) missingFields.push('studentIdNumber');
    if (!personalDetails.phoneNumber?.trim()) missingFields.push('phoneNumber');
    if (!academicDetails.college?.trim()) missingFields.push('college');
    if (!academicDetails.course?.trim()) missingFields.push('course');
    if (!dto.propertyId) missingFields.push('propertyId');

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Missing required application fields: ${missingFields.join(', ')}`,
      );
    }

    return { personalDetails, academicDetails };
  }

  private mergePersonalDetails(
    details: ApplicationPersonalDetailsDto | ApplicationPersonalDetails | undefined,
    applicant: User,
    existing?: ApplicationPersonalDetails,
  ): ApplicationPersonalDetails {
    return {
      fullName: applicant.fullName,
      email: applicant.email,
      studentIdNumber:
        details?.studentIdNumber ?? existing?.studentIdNumber ?? applicant.studentIdNumber,
      phoneNumber: details?.phoneNumber ?? existing?.phoneNumber ?? applicant.phoneNumber,
    };
  }

  private mergeAcademicDetails(
    details: ApplicationAcademicDetailsDto | ApplicationAcademicDetails | undefined,
    applicant: User,
    existing?: ApplicationAcademicDetails,
  ): ApplicationAcademicDetails {
    return {
      college: details?.college ?? existing?.college ?? applicant.college,
      course: details?.course ?? existing?.course ?? applicant.course,
    };
  }

  private async resolveHousingSelection(
    dto: SaveApplicationDraftDto,
    existing?: Application,
    requireAvailableUnit = false,
  ): Promise<{ property?: Property; unit?: Unit }> {
    const propertyId = dto.propertyId ?? existing?.property?.id;
    const propertyChanged =
      dto.propertyId !== undefined && dto.propertyId !== existing?.property?.id;
    const unitId = dto.unitId ?? (propertyChanged ? undefined : existing?.unit?.id);

    if (unitId && !propertyId) {
      throw new BadRequestException('propertyId is required when selecting a unit');
    }

    if (!propertyId) {
      return {};
    }

    const property = await this.findPropertyById(propertyId);
    const unit = await this.findUnit(unitId, property.id, requireAvailableUnit);
    return { property, unit };
  }

  private async findUnit(
    unitId: string | undefined,
    propertyId: string,
    requireAvailable: boolean,
  ): Promise<Unit | undefined> {
    if (!unitId) {
      return undefined;
    }

    const unit = await this.unitRepo.findOne({
      where: { id: unitId, property: { id: propertyId } },
    });
    if (!unit) {
      throw new BadRequestException('Selected unit does not belong to the selected property');
    }
    if (requireAvailable && (!unit.isAvailable || unit.occupiedCount >= unit.capacity)) {
      throw new BadRequestException('Selected unit is not available');
    }
    return unit;
  }

  private async findOwnedApplication(id: string, applicant: User): Promise<Application> {
    const application = await this.applicationRepo.findOne({
      where: { id },
      relations: ['applicant', 'property', 'unit'],
    });
    if (!application) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }
    if (application.applicant.id !== applicant.id) {
      throw new ForbiddenException('You can only modify your own applications');
    }
    return application;
  }

  private ensureDraft(application: Application): void {
    if (application.status !== ApplicationStatus.DRAFT) {
      throw new BadRequestException('Only draft applications can be modified or submitted');
    }
  }
}
