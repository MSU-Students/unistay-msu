import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TicketCategory, TicketPriority, TicketStatus } from '../entities/ticket.entity';

export class CreateTicketDto {
  @ApiProperty({ example: 'Leaking water pipe in 2nd floor CR' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Water is dripping continuously from the main pipe valve.' })
  @IsString()
  description: string;

  @ApiProperty({ enum: TicketCategory, default: TicketCategory.PLUMBING })
  @IsEnum(TicketCategory)
  category: TicketCategory;

  @ApiProperty({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsEnum(TicketPriority)
  priority: TicketPriority;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional({ example: ['http://localhost:9000/unistay-media/maintenance/photo1.jpg'] })
  @IsOptional()
  @IsArray()
  photoUrls?: string[];
}

export class UpdateTicketStatusDto {
  @ApiProperty({ enum: TicketStatus })
  @IsEnum(TicketStatus)
  status: TicketStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}

export class CreateOutageReportDto {
  @ApiProperty({ example: 'Water' })
  @IsString()
  utilityType: string;

  @ApiProperty({ example: 'Commercial Center & Dormitory Sector 2' })
  @IsString()
  affectedArea: string;

  @ApiProperty({ example: 'Emergency pump replacement in progress until 4 PM.' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ example: '2026-09-26T16:00:00Z' })
  @IsOptional()
  @IsDateString()
  estimatedRestoration?: string;
}
