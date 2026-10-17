import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsIn, IsOptional, IsUUID } from 'class-validator';

export class FinanceSummaryQueryDto {
  @ApiPropertyOptional({ description: 'Filter by property UUID' })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Start date (inclusive) in ISO 8601' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (inclusive) in ISO 8601' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({ description: "Which category to return: 'collected' | 'outstanding' | 'overdue' | 'all'", enum: ['collected','outstanding','overdue','all'] })
  @IsOptional()
  @IsIn(['collected', 'outstanding', 'overdue', 'all'])
  status?: 'collected' | 'outstanding' | 'overdue' | 'all';

  @ApiPropertyOptional({ description: 'Export format (background job available): csv | xlsx | pdf', enum: ['csv','xlsx','pdf'] })
  @IsOptional()
  @IsIn(['csv','xlsx','pdf'])
  export?: 'csv' | 'xlsx' | 'pdf';
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
