import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyType } from '../entities/property.entity';
import { ApplicationStatus } from '../entities/application.entity';

class UnitDetailsDto {
  @ApiPropertyOptional({ example: 'B-12' })
  @IsOptional()
  @IsString()
  unitNumber?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  bedrooms?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  bathrooms?: number;

  @ApiPropertyOptional({ example: 980 })
  @IsOptional()
  @IsNumber()
  size?: number;
}

export class CreatePropertyDto {
  @ApiProperty({ example: 'Sunset Residency' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'MSU Alumni Dormitory' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ enum: PropertyType, default: PropertyType.INSTITUTIONAL_DORM })
  @IsOptional()
  @IsEnum(PropertyType)
  type?: PropertyType;

  @ApiProperty({ example: 'Clean, safe institutional dorm near CNSM and College of Law.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'MSU Marawi Campus, 4th Street' })
  @IsString()
  address: string;

  @ApiProperty({ example: 1500 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  price: number;

  @ApiPropertyOptional({ type: UnitDetailsDto, example: { unitNumber: 'B-12', bedrooms: 2, bathrooms: 2, size: 980 } })
  @IsOptional()
  @ValidateNested()
  @Type(() => UnitDetailsDto)
  unitDetails?: UnitDetailsDto;

  @ApiPropertyOptional({ type: [String], example: ['a.jpg', 'b.jpg'] })
  @IsOptional()
  @IsArray()
  photos?: string[];

  @ApiPropertyOptional({ example: '5 minutes walk from CNSM' })
  @IsOptional()
  @IsString()
  proximityToCollege?: string;

  @ApiPropertyOptional({ example: ['Wi-Fi', 'Study Hall', 'CCTV', 'Water Tank'] })
  @IsOptional()
  @IsArray()
  amenities?: string[];

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  minMonthlyRate?: number;

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  maxMonthlyRate?: number;
}

export class UpdatePropertyDto extends CreatePropertyDto {
  @ApiPropertyOptional({ example: 'Sunset Residency' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'MSU Marawi Campus, 4th Street' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  price?: number;
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
