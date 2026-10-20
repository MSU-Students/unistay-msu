import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReportFilterDto } from './dto/report-filter.dto';
import { ReportsService } from './reports.service';

@ApiTags('University Administration Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.UNIVERSITY_ADMIN)
@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get system-wide reporting summary',
    description: 'Property and date filters apply where supported. Status is ignored because each module has a different status vocabulary.',
  })
  getOverview(@Query() filters: ReportFilterDto) {
    return this.reportsService.getOverview(filters);
  }

  @Get('applications')
  @ApiOperation({ summary: 'Report on housing applications' })
  getApplications(@Query() filters: ReportFilterDto) {
    return this.reportsService.getApplications(filters);
  }

  @Get('billing')
  @ApiOperation({ summary: 'Report on invoice balances and collections' })
  getBilling(@Query() filters: ReportFilterDto) {
    return this.reportsService.getBilling(filters);
  }

  @Get('maintenance')
  @ApiOperation({ summary: 'Report on maintenance tickets' })
  getMaintenance(@Query() filters: ReportFilterDto) {
    return this.reportsService.getMaintenance(filters);
  }

  @Get('gigs')
  @ApiOperation({
    summary: 'Report on gig activity; property filters are ignored because gigs have no property relation',
  })
  getGigs(@Query() filters: ReportFilterDto) {
    return this.reportsService.getGigs(filters);
  }

  @Get('properties')
  @ApiOperation({
    summary: 'Report on property occupancy and associated operations',
    description: 'Date filters apply to associated activity. Status is ignored because the rollup combines modules with different statuses.',
  })
  getProperties(@Query() filters: ReportFilterDto) {
    return this.reportsService.getProperties(filters);
  }

  @Get('attention')
  @ApiOperation({
    summary: 'Get pending and overdue operational alerts',
    description: 'Property and date filters apply where supported. Status and sorting are ignored because this endpoint combines different alert types.',
  })
  getAttention(@Query() filters: ReportFilterDto) {
    return this.reportsService.getAttention(filters);
  }
}
