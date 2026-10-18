import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  InvoiceItemCategory,
  InvoiceStatus,
  PaymentMethod,
} from '../entities/invoice.entity';

export class CreateInvoiceItemDto {
  @ApiProperty({ example: 'Monthly rent - Room 12' })
  @IsString()
  description: string;

  @ApiProperty({ enum: InvoiceItemCategory })
  @IsEnum(InvoiceItemCategory)
  category: InvoiceItemCategory;

  @ApiProperty({ example: 1800 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  amount: number;
}

export class GenerateInvoiceDto {
  @ApiProperty()
  @IsUUID()
  tenantId: string;

  @ApiPropertyOptional({ description: 'Active lease used to derive rent and unit.' })
  @IsOptional()
  @IsUUID()
  leaseId?: string;

  @ApiPropertyOptional({ description: 'Optional unit for a manual invoice.' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiProperty({ example: '2026-10-01' })
  @IsDateString()
  billingPeriodStart: string;

  @ApiProperty({ example: '2026-10-31' })
  @IsDateString()
  billingPeriodEnd: string;

  @ApiProperty({ example: '2026-10-15' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ type: [CreateInvoiceItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items?: CreateInvoiceItemDto[];

  @ApiPropertyOptional({ example: 1800, description: 'Required when no lease is selected.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  rentAmount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  tax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateInvoiceStatusDto {
  @ApiProperty({ enum: [InvoiceStatus.ISSUED, InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.VOIDED] })
  @IsEnum(InvoiceStatus)
  status: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Required when voiding; retained in the audit snapshot.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class InvoiceListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 20;

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreateInvoiceDto {
  @ApiProperty()
  @IsUUID()
  tenantId: string;

  @ApiProperty()
  @IsUUID()
  propertyId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiProperty({ example: 1800 })
  @IsNumber()
  @Min(0.01)
  @Max(99999999.99)
  rentAmount: number;

  @ApiPropertyOptional({ example: 250 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999.99)
  electricityAmount?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999.99)
  waterAmount?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999.99)
  otherFees?: number;

  @ApiProperty({ example: '2026-10-15' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  utilitySplitNotes?: string;
}

export class RecordPaymentDto {
  @ApiProperty()
  @IsUUID()
  invoiceId: string;

  @ApiProperty({ example: 2170 })
  @IsNumber()
  amount: number;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'OFFLINE_PAY_1727312345' })
  @IsOptional()
  @IsString()
  offlineReferenceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

export class CalculateUtilitySplitDto {
  @ApiProperty({ example: 3500 })
  @IsNumber()
  totalElectricBill: number;

  @ApiProperty({ example: 1200 })
  @IsNumber()
  totalWaterBill: number;

  @ApiProperty({ example: 8 })
  @IsNumber()
  occupantCount: number;
}
