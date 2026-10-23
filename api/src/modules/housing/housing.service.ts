import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { Application, ApplicationStatus } from './entities/application.entity';
import { CreateApplicationDto, CreatePropertyDto } from './dto/housing.dto';
import { User } from '../users/entities/user.entity';
import { StorageService } from '../storage/storage.service';
import {
  CreateDraftApplicationDto,
  SubmitApplicationDto,
  SupportingDocumentDto,
  UpdateApplicationDto,
} from './dto/housing-application.dto';
import {
  HousingApplication,
  HousingApplicationDocument,
  HousingApplicationStatus,
} from './entities/housing-application.entity';

@Injectable()
export class HousingService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(HousingApplication)
    private readonly housingApplicationRepo: Repository<HousingApplication>,
    private readonly storageService: StorageService,
  ) {}

  async saveDraft(
    dto: CreateDraftApplicationDto,
    student: User,
  ): Promise<HousingApplication> {
    const existing = await this.housingApplicationRepo.findOne({
      where: { studentId: student.id, status: HousingApplicationStatus.DRAFT },
      order: { updatedAt: 'DESC' },
    });
    if (existing) {
      return this.applyDraftUpdate(existing, dto);
    }

    const submitted = await this.housingApplicationRepo.findOne({
      where: { studentId: student.id, status: HousingApplicationStatus.SUBMITTED },
    });
    if (submitted) {
      throw new ForbiddenException('A submitted housing application cannot be edited.');
    }

    const application = this.housingApplicationRepo.create({
      studentId: student.id,
      status: HousingApplicationStatus.DRAFT,
      personalDetails: {},
      academicDetails: {},
      housingPreferences: {},
      supportingDocuments: [],
    });
    return this.applyDraftUpdate(application, dto);
  }

  async updateDraft(
    id: string,
    dto: UpdateApplicationDto,
    student: User,
  ): Promise<HousingApplication> {
    const application = await this.findOwnedHousingApplication(id, student);
    this.ensureDraft(application);
    return this.applyDraftUpdate(application, dto);
  }

  async submitHousingApplication(
    id: string,
    dto: SubmitApplicationDto,
    student: User,
  ): Promise<{
    confirmationId: string;
    timestamp: Date;
    status: HousingApplicationStatus;
  }> {
    const application = await this.findOwnedHousingApplication(id, student);
    this.ensureDraft(application);

    const { personalDetails, academicDetails, housingPreferences } = this.splitDetails(dto);
    application.personalDetails = personalDetails;
    application.academicDetails = academicDetails;
    application.housingPreferences = housingPreferences;
    if (dto.supportingDocuments !== undefined) {
      application.supportingDocuments = this.resolveDocumentReferences(dto.supportingDocuments);
    }
    application.status = HousingApplicationStatus.SUBMITTED;
    application.submittedAt = new Date();
    application.confirmationCode = `HA-${application.id.toUpperCase()}`;

    const submitted = await this.housingApplicationRepo.save(application);
    return {
      confirmationId: submitted.confirmationCode,
      timestamp: submitted.submittedAt,
      status: submitted.status,
    };
  }

  async findMyHousingApplication(student: User): Promise<HousingApplication | null> {
    return this.housingApplicationRepo.findOne({
      where: { studentId: student.id },
      order: { updatedAt: 'DESC' },
    });
  }

  private async findOwnedHousingApplication(id: string, student: User): Promise<HousingApplication> {
    const application = await this.housingApplicationRepo.findOne({ where: { id } });
    if (!application) {
      throw new NotFoundException(`Housing application with ID ${id} not found.`);
    }
    if (application.studentId !== student.id) {
      throw new ForbiddenException('You can only access your own housing application.');
    }
    return application;
  }

  private ensureDraft(application: HousingApplication): void {
    if (application.status !== HousingApplicationStatus.DRAFT) {
      throw new ForbiddenException('Only draft housing applications can be updated or submitted.');
    }
  }

  private async applyDraftUpdate(
    application: HousingApplication,
    dto: CreateDraftApplicationDto | UpdateApplicationDto,
  ): Promise<HousingApplication> {
    const details = this.splitDetails(dto);
    application.personalDetails = { ...application.personalDetails, ...details.personalDetails };
    application.academicDetails = { ...application.academicDetails, ...details.academicDetails };
    application.housingPreferences = {
      ...application.housingPreferences,
      ...details.housingPreferences,
    };
    if (dto.supportingDocuments !== undefined) {
      application.supportingDocuments = this.resolveDocumentReferences(dto.supportingDocuments);
    }
    return this.housingApplicationRepo.save(application);
  }

  private splitDetails(dto: CreateDraftApplicationDto | SubmitApplicationDto) {
    const {
      fullName,
      studentNumber,
      email,
      contactNumber,
      sex,
      dateOfBirth,
      religion,
      homeAddress,
      city,
      province,
      emergencyContactName,
      emergencyContactNumber,
      emergencyContactRelationship,
      university,
      college,
      degreeProgram,
      yearLevel,
      academicYear,
      semester,
      housingType,
      propertyId,
      roomType,
      otherPreferences,
      roommatePreferences,
    } = dto;

    return {
      personalDetails: {
        fullName,
        studentNumber,
        email,
        contactNumber,
        sex,
        dateOfBirth,
        religion,
        homeAddress,
        city,
        province,
        emergencyContactName,
        emergencyContactNumber,
        emergencyContactRelationship,
      },
      academicDetails: {
        university,
        college,
        degreeProgram,
        yearLevel,
        academicYear,
        semester,
      },
      housingPreferences: {
        housingType,
        propertyId,
        roomType,
        otherPreferences,
        roommatePreferences,
      },
    };
  }

  private resolveDocumentReferences(
    documents?: SupportingDocumentDto[],
  ): HousingApplicationDocument[] {
    return (documents ?? []).map((document) => {
      const storageKey = document.storageKey.trim();
      if (!storageKey || storageKey.startsWith('/') || storageKey.includes('..')) {
        throw new BadRequestException('Supporting document storage keys must be valid object keys.');
      }
      return {
        ...document,
        storageKey,
        url: this.storageService.getObjectReference(storageKey),
      };
    });
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
