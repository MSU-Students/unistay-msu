import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ValidationError, validate } from 'class-validator';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Application, ApplicationStatus } from './entities/application.entity';
import {
  HousingApplication,
  HousingApplicationStatus,
} from './entities/housing-application.entity';
import { Property, Unit } from './entities/property.entity';
import { HousingService } from './housing.service';
import { SubmitApplicationDto } from './dto/housing-application.dto';

describe('HousingService applications', () => {
  const propertyId = 'd945452b-0b56-49f5-9c75-4a85a4e23120';
  const applicant: User = {
    id: 'student-id',
    fullName: 'Mina Student',
    email: 'mina@msu.edu.ph',
    studentIdNumber: '2024-001',
    phoneNumber: '09170000000',
    college: 'CNSM',
    course: 'BS Chemistry',
  } as User;

  let service: HousingService;
  let propertyRepo: {
    findOne: jest.Mock;
  };
  let applicationRepo: {
    create: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let unitRepo: {
    findOne: jest.Mock;
  };
  let housingApplicationRepo: {
    create: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    propertyRepo = { findOne: jest.fn() };
    applicationRepo = {
      create: jest.fn((application) => application),
      findOne: jest.fn(),
      save: jest.fn(async (application) => application),
    };
    unitRepo = { findOne: jest.fn() };
    housingApplicationRepo = {
      create: jest.fn((application) => application),
      findOne: jest.fn(),
      save: jest.fn(async (application) => application),
    };
    service = new HousingService(
      propertyRepo as unknown as Repository<Property>,
      applicationRepo as unknown as Repository<Application>,
      unitRepo as unknown as Repository<Unit>,
      housingApplicationRepo as unknown as Repository<HousingApplication>,
    );
  });

  it('rejects whitespace-only required fields in final submissions', async () => {
    const dto = plainToInstance(SubmitApplicationDto, {
      personalDetails: {
        fullName: '   ',
        dateOfBirth: '2004-02-03',
        email: 'mina@msu.edu.ph',
        contactNumber: '09170000000',
        address: 'Marawi City',
        emergencyContact: {
          fullName: 'Family Member',
          relationship: 'Parent',
          contactNumber: '09171111111',
        },
      },
      academicDetails: {
        studentIdNumber: '2024-001',
        degreeProgram: 'BS Chemistry',
        yearLevel: 2,
        college: 'CNSM',
      },
      housingPreferences: {
        preferredDorm: 'MSU Alumni Dormitory',
        preferredUnitType: 'Shared',
        roommatePreferences: 'No preference',
      },
    });

    const errors = await validate(dto);
    const hasWhitespaceViolation = (validationErrors: ValidationError[]) =>
      validationErrors.some(
        (error) =>
          (error.property === 'fullName' &&
            error.constraints?.matches !== undefined) ||
          hasWhitespaceViolation(error.children ?? []),
      );

    expect(hasWhitespaceViolation(errors)).toBe(true);
  });

  it('creates a draft owned by the authenticated student', async () => {
    housingApplicationRepo.findOne.mockResolvedValue(null);

    const draft = await service.createHousingApplicationDraft(
      { personalDetails: { fullName: 'Mina Student' } },
      applicant,
    );

    expect(draft.studentId).toBe(applicant.id);
    expect(draft.status).toBe(HousingApplicationStatus.DRAFT);
    expect(draft.personalDetails).toEqual({ fullName: 'Mina Student' });
    expect(draft.supportingDocuments).toEqual([]);
    expect(housingApplicationRepo.save).toHaveBeenCalledTimes(1);
  });

  it('merges draft updates and preserves other saved fields', async () => {
    const draft = {
      id: 'housing-app-id',
      studentId: applicant.id,
      status: HousingApplicationStatus.DRAFT,
      personalDetails: {
        fullName: 'Mina Student',
        emergencyContact: { fullName: 'Family Member', relationship: 'Parent' },
      },
      academicDetails: { college: 'CNSM' },
    } as HousingApplication;
    housingApplicationRepo.findOne.mockResolvedValue(draft);

    const updated = await service.updateHousingApplicationDraft(
      draft.id,
      {
        personalDetails: {
          emergencyContact: { contactNumber: '09170000000' },
        },
      },
      applicant,
    );

    expect(updated.personalDetails?.fullName).toBe('Mina Student');
    expect(updated.personalDetails?.emergencyContact).toEqual({
      fullName: 'Family Member',
      relationship: 'Parent',
      contactNumber: '09170000000',
    });
    expect(updated.academicDetails?.college).toBe('CNSM');
  });

  it('submits a draft and returns a confirmation receipt', async () => {
    const draft = {
      id: '4bb68676-e86b-42e8-b785-08af4b220331',
      studentId: applicant.id,
      status: HousingApplicationStatus.DRAFT,
      supportingDocuments: [],
    } as HousingApplication;
    housingApplicationRepo.findOne.mockResolvedValue(draft);

    const receipt = await service.submitHousingApplication(
      draft.id,
      {
        personalDetails: {
          fullName: 'Mina Student',
          dateOfBirth: '2004-02-03',
          email: 'mina@msu.edu.ph',
          contactNumber: '09170000000',
          address: 'Marawi City',
          emergencyContact: {
            fullName: 'Family Member',
            relationship: 'Parent',
            contactNumber: '09171111111',
          },
        },
        academicDetails: {
          studentIdNumber: '2024-001',
          degreeProgram: 'BS Chemistry',
          yearLevel: 2,
          college: 'CNSM',
        },
        housingPreferences: {
          preferredDorm: 'MSU Alumni Dormitory',
          preferredUnitType: 'Shared',
          roommatePreferences: 'No preference',
        },
      },
      applicant,
    );

    expect(draft.status).toBe(HousingApplicationStatus.SUBMITTED);
    expect(draft.submittedAt).toBeInstanceOf(Date);
    expect(receipt).toMatchObject({
      confirmationId: draft.id,
      confirmationCode: `HSG-${draft.id.toUpperCase()}`,
      status: HousingApplicationStatus.SUBMITTED,
    });
    expect(receipt.submittedAt).toBe(draft.submittedAt);
  });

  it('prevents editing a submitted housing application', async () => {
    housingApplicationRepo.findOne.mockResolvedValue({
      id: 'housing-app-id',
      studentId: applicant.id,
      status: HousingApplicationStatus.SUBMITTED,
    } as HousingApplication);

    await expect(
      service.updateHousingApplicationDraft('housing-app-id', {}, applicant),
    ).rejects.toThrow(BadRequestException);
    expect(housingApplicationRepo.save).not.toHaveBeenCalled();
  });

  it('saves an incomplete application as a draft without a submission timestamp', async () => {
    const draft = await service.saveApplicationDraft({}, applicant);

    expect(draft.status).toBe(ApplicationStatus.DRAFT);
    expect(draft.submittedAt).toBeUndefined();
    expect(draft.property).toBeUndefined();
    expect(applicationRepo.save).toHaveBeenCalledTimes(1);
  });

  it('updates saved fields without changing the draft status', async () => {
    const draft: Application = {
      id: 'application-id',
      applicant,
      status: ApplicationStatus.DRAFT,
    } as Application;
    applicationRepo.findOne.mockResolvedValue(draft);

    const updated = await service.updateApplicationDraft(
      draft.id,
      { personalDetails: { studentIdNumber: '2025-002' } },
      applicant,
    );

    expect(updated.status).toBe(ApplicationStatus.DRAFT);
    expect(updated.personalDetails?.studentIdNumber).toBe('2025-002');
    expect(updated.submittedAt).toBeUndefined();
    expect(applicationRepo.save).toHaveBeenCalledWith(draft);
  });

  it('rejects a final submission when required personal or academic details are missing', async () => {
    await expect(
      service.submitApplication({ propertyId }, { ...applicant, studentIdNumber: undefined }),
    ).rejects.toThrow(
      new BadRequestException(
        'Missing required application fields: studentIdNumber',
      ),
    );

    expect(propertyRepo.findOne).not.toHaveBeenCalled();
    expect(applicationRepo.save).not.toHaveBeenCalled();
  });

  it('keeps an incomplete draft unsubmitted when final validation fails', async () => {
    const incompleteApplicant = {
      ...applicant,
      studentIdNumber: undefined,
      phoneNumber: undefined,
      college: undefined,
      course: undefined,
    };
    const property = { id: propertyId } as Property;
    const draft: Application = {
      id: 'application-id',
      applicant: incompleteApplicant,
      property,
      status: ApplicationStatus.DRAFT,
    } as Application;
    propertyRepo.findOne.mockResolvedValue(property);
    applicationRepo.findOne.mockResolvedValue(draft);

    await expect(
      service.submitApplicationDraft(draft.id, {}, incompleteApplicant),
    ).rejects.toThrow(BadRequestException);

    expect(draft.status).toBe(ApplicationStatus.DRAFT);
    expect(draft.submittedAt).toBeUndefined();
    expect(applicationRepo.save).not.toHaveBeenCalled();
  });

  it('saves a complete application as pending with a submitted timestamp and detail snapshots', async () => {
    const property = { id: propertyId } as Property;
    propertyRepo.findOne.mockResolvedValue(property);

    const application = await service.submitApplication({ propertyId }, applicant);

    expect(application.status).toBe(ApplicationStatus.PENDING);
    expect(application.submittedAt).toBeInstanceOf(Date);
    expect(application.personalDetails).toEqual({
      fullName: applicant.fullName,
      email: applicant.email,
      studentIdNumber: applicant.studentIdNumber,
      phoneNumber: applicant.phoneNumber,
    });
    expect(application.academicDetails).toEqual({
      college: applicant.college,
      course: applicant.course,
    });
    expect(applicationRepo.save).toHaveBeenCalledTimes(1);
  });

  it('transitions an owned draft to pending only after validation succeeds', async () => {
    const property = { id: propertyId } as Property;
    const draft: Application = {
      id: 'application-id',
      applicant,
      property,
      status: ApplicationStatus.DRAFT,
    } as Application;
    propertyRepo.findOne.mockResolvedValue(property);
    applicationRepo.findOne.mockResolvedValue(draft);

    const submitted = await service.submitApplicationDraft(draft.id, {}, applicant);

    expect(submitted.status).toBe(ApplicationStatus.PENDING);
    expect(submitted.submittedAt).toBeInstanceOf(Date);
    expect(applicationRepo.save).toHaveBeenCalledWith(draft);
  });

  it("prevents a student from modifying another student's application", async () => {
    const draft = {
      id: 'application-id',
      applicant: { ...applicant, id: 'different-student' },
      status: ApplicationStatus.DRAFT,
    } as Application;
    applicationRepo.findOne.mockResolvedValue(draft);

    await expect(
      service.updateApplicationDraft(draft.id, {}, applicant),
    ).rejects.toThrow(ForbiddenException);
    expect(applicationRepo.save).not.toHaveBeenCalled();
  });
});
