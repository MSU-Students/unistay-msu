import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { FacilityType } from '../entities/facility.entity';

export class CreateFacilityDto {
  @ApiProperty({ example: 'Dorm 1 Smart Laundry Hub' })
  @IsString()
  name: string;

  @ApiProperty({ enum: FacilityType, default: FacilityType.LAUNDRY })
  @IsEnum(FacilityType)
  type: FacilityType;

  @ApiProperty()
  @IsUUID()
  propertyId: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  slotCapacity: number;

  @ApiPropertyOptional({ example: '07:00 - 21:00' })
  @IsOptional()
  @IsString()
  operationalHours?: string;
}

export class CreateBookingDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty({ example: '2026-09-26T14:00:00.000Z' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ example: '2026-09-26T16:00:00.000Z' })
  @IsDateString()
  endTime: string;
}

export class CreateIncidentReportDto {
  @ApiProperty({ example: 'Noise violation past quiet hours' })
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsUUID()
  propertyId: string;

  @ApiPropertyOptional({ example: 'low' })
  @IsOptional()
  @IsString()
  severity?: string;
}
