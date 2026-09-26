import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FacilitiesService } from './facilities.service';
import { CreateBookingDto, CreateFacilityDto, CreateIncidentReportDto } from './dto/facilities.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@ApiTags('Shared Facilities & Governance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('facilities')
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List shared facilities (laundry, parking, study halls)' })
  async getFacilities(@Query('propertyId') propertyId?: string) {
    return this.facilitiesService.findAllFacilities(propertyId);
  }

  @Post()
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Create a shared facility' })
  async createFacility(@Body() dto: CreateFacilityDto) {
    return this.facilitiesService.createFacility(dto);
  }

  @Post('bookings')
  @ApiOperation({ summary: 'Reserve a time-slot for a facility' })
  async createBooking(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: User,
  ) {
    return this.facilitiesService.createBooking(dto, user);
  }

  @Get('my-bookings')
  @ApiOperation({ summary: 'List user facility reservations' })
  async getMyBookings(@CurrentUser() user: User) {
    return this.facilitiesService.findBookingsByUser(user);
  }

  @Post('incidents')
  @ApiOperation({ summary: 'Submit an incident or security report' })
  async reportIncident(
    @Body() dto: CreateIncidentReportDto,
    @CurrentUser() user: User,
  ) {
    return this.facilitiesService.createIncident(dto, user);
  }

  @Public()
  @Get('rules')
  @ApiOperation({ summary: 'Retrieve dormitory house rules & governance policies' })
  async getRules(@Query('propertyId') propertyId?: string) {
    return this.facilitiesService.findAllRules(propertyId);
  }
}
