import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsIn, IsNumber, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
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

export class UpdatePropertyAccreditationDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @ApiPropertyOptional({ example: 'Please provide current safety inspection documents.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}
