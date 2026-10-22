import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PropertyType } from '../entities/property.entity';
import { ApplicationStatus } from '../entities/application.entity';

export class CreatePropertyDto {
  @ApiProperty({ example: 'MSU Alumni Dormitory' })
  @IsString()
  name: string;

  @ApiProperty({ enum: PropertyType, default: PropertyType.INSTITUTIONAL_DORM })
  @IsEnum(PropertyType)
  type: PropertyType;

  @ApiProperty({ example: 'Clean, safe institutional dorm near CNSM and College of Law.' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'MSU Marawi Campus, 4th Street' })
  @IsString()
  address: string;

  @ApiPropertyOptional({ example: '5 minutes walk from CNSM' })
  @IsOptional()
  @IsString()
  proximityToCollege?: string;

  @ApiPropertyOptional({ example: ['Wi-Fi', 'Study Hall', 'CCTV', 'Water Tank'] })
  @IsOptional()
  @IsArray()
  amenities?: string[];

  @ApiProperty({ example: 1500 })
  @IsNumber()
  minMonthlyRate: number;

  @ApiProperty({ example: 2500 })
  @IsNumber()
  maxMonthlyRate: number;
}

export class CreateApplicationDto {
  @ApiProperty()
  @IsUUID()
  propertyId: string;

  @ApiPropertyOptional({ type: () => ApplicationPersonalDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ApplicationPersonalDetailsDto)
  personalDetails?: ApplicationPersonalDetailsDto;

  @ApiPropertyOptional({ type: () => ApplicationAcademicDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ApplicationAcademicDetailsDto)
  academicDetails?: ApplicationAcademicDetailsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ example: 'Incoming 3rd year CNSM BS Chemistry student.' })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class SaveApplicationDraftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional({ type: () => ApplicationPersonalDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ApplicationPersonalDetailsDto)
  personalDetails?: ApplicationPersonalDetailsDto;

  @ApiPropertyOptional({ type: () => ApplicationAcademicDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ApplicationAcademicDetailsDto)
  academicDetails?: ApplicationAcademicDetailsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ApplicationPersonalDetailsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  studentIdNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

export class ApplicationAcademicDetailsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  college?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  course?: string;
}

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  status: ApplicationStatus;
}
