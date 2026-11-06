import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { GigStatus } from '../entities/gig.entity';

export class CreateGigDto {
  @ApiProperty({ example: 'Need someone to pick up biology book from CNSM Library' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Drop off at 2nd floor Alumni Dormitory room 204. Need today before 5pm.' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'Errands & Delivery' })
  @IsString()
  category: string;

  @ApiProperty({ example: 150 })
  @IsNumber()
  compensationAmount: number;

  @ApiPropertyOptional({ example: 'CNSM to Alumni Dorm' })
  @IsOptional()
  @IsString()
  locationNote?: string;
}

export class ApplyForGigDto {
  @ApiPropertyOptional({ example: 'I am in CNSM right now and can deliver in 15 mins.' })
  @IsOptional()
  @IsString()
  pitch?: string;
}

export class UpdateGigStatusDto {
  @ApiProperty({ enum: GigStatus, example: GigStatus.COMPLETED })
  @IsEnum(GigStatus)
  status: GigStatus;

  @ApiPropertyOptional({ example: 'Package safely delivered to room 204.' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 'Unexpected class laboratory schedule.' })
  @IsOptional()
  @IsString()
  cancellationReason?: string;
}

export class CreateGigNoteDto {
  @ApiProperty({ example: 'I have arrived at CNSM library and picked up the book.' })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class GigQueryDto {
  @ApiPropertyOptional({ example: 'Delivery & Errands' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: GigStatus, example: GigStatus.OPEN })
  @IsOptional()
  @IsEnum(GigStatus)
  status?: GigStatus;
}

