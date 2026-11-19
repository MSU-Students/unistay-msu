import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsIn, IsOptional, IsUUID } from 'class-validator';
import { InvoiceStatus } from '../entities/invoice.entity';

export class FinanceSummaryQueryDto {
  @ApiPropertyOptional({ description: 'Filter by property UUID' })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Start date (inclusive); applies to payment dates for collected totals and invoice creation dates for balances' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (inclusive); applies to payment dates for collected totals and invoice creation dates for balances' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter invoices by payment status',
    enum: ['all', ...Object.values(InvoiceStatus)],
  })
  @IsOptional()
  @IsIn(['all', ...Object.values(InvoiceStatus)])
  status?: InvoiceStatus | 'all';
}

export class FinanceSummaryByProperty {
  propertyId: string;
  collected: number;
  outstanding: number;
  overdue: number;
}

export class FinanceSummaryResponseDto {
  totalCollected: number;
  totalOutstanding: number;
  totalOverdue: number;
  breakdownByProperty: FinanceSummaryByProperty[];
  anomalies: Array<{ id?: string; type: string; description: string; severity?: 'low' | 'medium' | 'high'; refs?: string[] }>;
  generatedAt: string;
  filters: Partial<FinanceSummaryQueryDto>;
}
