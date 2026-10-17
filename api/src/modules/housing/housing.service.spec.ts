import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Application, ApplicationStatus } from './entities/application.entity';
import { Property, Unit } from './entities/property.entity';
import { HousingService } from './housing.service';

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

  beforeEach(() => {
    propertyRepo = { findOne: jest.fn() };
    applicationRepo = {
      create: jest.fn((application) => application),
      findOne: jest.fn(),
      save: jest.fn(async (application) => application),
    };
    unitRepo = { findOne: jest.fn() };
    service = new HousingService(
      propertyRepo as unknown as Repository<Property>,
      applicationRepo as unknown as Repository<Application>,
      unitRepo as unknown as Repository<Unit>,
    );
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
