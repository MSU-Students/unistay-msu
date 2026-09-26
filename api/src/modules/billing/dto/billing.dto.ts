import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaymentMethod } from './entities/invoice.entity';

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
  rentAmount: number;

  @ApiPropertyOptional({ example: 250 })
  @IsOptional()
  @IsNumber()
  electricityAmount?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsNumber()
  waterAmount?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  otherFees?: number;

  @ApiProperty({ example: '2026-10-15' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
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
