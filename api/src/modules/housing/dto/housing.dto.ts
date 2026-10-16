import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  Matches,
  IsString,
  IsUUID,
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ example: 'Incoming 3rd year CNSM BS Chemistry student.' })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  status: ApplicationStatus;
}

export class AdminApplicationReportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;
}

export class UpdateApplicationComplianceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  policyException?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  policyExceptionReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  escalated?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  escalationReason?: string;
}
