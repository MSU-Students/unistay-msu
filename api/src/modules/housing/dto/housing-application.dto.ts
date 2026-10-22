import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsDefined,
  IsEmail,
  IsInt,
  Matches,
  IsNotEmpty,
  Min,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';

export class DraftEmergencyContactDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;
}

export class DraftPersonalDetailsDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DraftEmergencyContactDto)
  emergencyContact?: DraftEmergencyContactDto;
}

export class DraftAcademicDetailsDto {
  @IsOptional()
  @IsString()
  studentIdNumber?: string;

  @IsOptional()
  @IsString()
  degreeProgram?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearLevel?: number;

  @IsOptional()
  @IsString()
  college?: string;
}

export class DraftHousingPreferencesDto {
  @IsOptional()
  @IsString()
  preferredDorm?: string;

  @IsOptional()
  @IsString()
  preferredUnitType?: string;

  @IsOptional()
  @IsString()
  roommatePreferences?: string;
}

export class SupportingDocumentDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  key: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}

export class CreateDraftApplicationDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DraftPersonalDetailsDto)
  personalDetails?: DraftPersonalDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DraftAcademicDetailsDto)
  academicDetails?: DraftAcademicDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DraftHousingPreferencesDto)
  housingPreferences?: DraftHousingPreferencesDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupportingDocumentDto)
  supportingDocuments?: SupportingDocumentDto[];
}

export class UpdateApplicationDto extends PartialType(
  CreateDraftApplicationDto,
) {}

export class SubmitEmergencyContactDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  relationship: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  contactNumber: string;
}

export class SubmitPersonalDetailsDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  fullName: string;

  @IsDateString()
  dateOfBirth: string;

  @IsEmail()
  @Matches(/\S/)
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  contactNumber: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  address: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => SubmitEmergencyContactDto)
  emergencyContact: SubmitEmergencyContactDto;
}

export class SubmitAcademicDetailsDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  studentIdNumber: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  degreeProgram: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearLevel: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  college: string;
}

export class SubmitHousingPreferencesDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  preferredDorm: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  preferredUnitType: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  roommatePreferences: string;
}

export class SubmitApplicationDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => SubmitPersonalDetailsDto)
  personalDetails: SubmitPersonalDetailsDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => SubmitAcademicDetailsDto)
  academicDetails: SubmitAcademicDetailsDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => SubmitHousingPreferencesDto)
  housingPreferences: SubmitHousingPreferencesDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupportingDocumentDto)
  supportingDocuments?: SupportingDocumentDto[];
}
