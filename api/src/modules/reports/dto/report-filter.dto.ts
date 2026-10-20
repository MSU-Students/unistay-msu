import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  IsString,
  IsUUID,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  REPORT_PAGE_SIZE_DEFAULT,
  REPORT_PAGE_SIZE_MAX,
} from '../reports.constants';

@ValidatorConstraint({ name: 'dateRange', async: false })
export class DateRangeConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: { object: ReportFilterDto }): boolean {
    const { dateFrom, dateTo } = args.object;
    return !dateFrom || !dateTo || new Date(dateFrom).getTime() <= new Date(dateTo).getTime();
  }

  defaultMessage(): string {
    return 'dateFrom must be on or before dateTo';
  }
}

export class ReportFilterDto {
  @ApiPropertyOptional({ description: 'Filter by one property UUID' })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by multiple property UUIDs (comma-separated or repeated)',
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((id) => id.trim()) : value,
  )
  @IsUUID(undefined, { each: true })
  propertyIds?: string[];

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @Validate(DateRangeConstraint)
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    default: REPORT_PAGE_SIZE_DEFAULT,
    minimum: 1,
    maximum: REPORT_PAGE_SIZE_MAX,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(REPORT_PAGE_SIZE_MAX)
  pageSize = REPORT_PAGE_SIZE_DEFAULT;

  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'dueDate', 'status', 'title', 'name'] })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'dueDate', 'status', 'title', 'name'])
  sortBy = 'createdAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.toUpperCase() : value)
  @IsIn(['ASC', 'DESC'])
  sortOrder = 'DESC';
}
