import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { CreateOutageReportDto, CreateTicketDto, UpdateTicketStatusDto } from './dto/maintenance.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@ApiTags('Maintenance & Utilities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('tickets')
  @ApiOperation({ summary: 'List maintenance tickets' })
  async getTickets(@CurrentUser() user: User) {
    if (user.role === Role.STUDENT) {
      return this.maintenanceService.findAllTickets(user.id);
    }
    return this.maintenanceService.findAllTickets();
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get single ticket details' })
  async getTicketById(@Param('id') id: string) {
    return this.maintenanceService.findTicketById(id);
  }

  @Post('tickets')
  @ApiOperation({ summary: 'File a maintenance ticket with photo evidence' })
  async createTicket(
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: User,
  ) {
    return this.maintenanceService.createTicket(dto, user);
  }

  @Patch('tickets/:id/status')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Update ticket resolution status' })
  async updateTicketStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.maintenanceService.updateTicketStatus(id, dto);
  }

  @Public()
  @Get('outages')
  @ApiOperation({ summary: 'Get active campus utility outage reports' })
  async getOutages() {
    return this.maintenanceService.findActiveOutages();
  }

  @Post('outages')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Publish a utility outage alert' })
  async createOutage(
    @Body() dto: CreateOutageReportDto,
    @CurrentUser() user: User,
  ) {
    return this.maintenanceService.createOutage(dto, user);
  }
}
