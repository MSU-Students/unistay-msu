import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HousingService } from './housing.service';
import { CreateApplicationDto, CreatePropertyDto, UpdateApplicationStatusDto } from './dto/housing.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@ApiTags('Housing & Dormitories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('housing')
export class HousingController {
  constructor(private readonly housingService: HousingService) {}

  @Public()
  @Get('properties')
  @ApiOperation({ summary: 'Search properties & dormitories' })
  async findAllProperties(
    @Query('type') type?: string,
    @Query('maxPrice') maxPrice?: number,
  ) {
    return this.housingService.findAllProperties({ type, maxPrice });
  }

  @Public()
  @Get('properties/:id')
  @ApiOperation({ summary: 'Get details for a property' })
  async findPropertyById(@Param('id') id: string) {
    return this.housingService.findPropertyById(id);
  }

  @Post('properties')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Create a property/dormitory listing' })
  async createProperty(
    @Body() dto: CreatePropertyDto,
    @CurrentUser() user: User,
  ) {
    return this.housingService.createProperty(dto, user);
  }

  @Post('applications')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Submit an application for a dorm/boarding house' })
  async apply(
    @Body() dto: CreateApplicationDto,
    @CurrentUser() user: User,
  ) {
    return this.housingService.createApplication(dto, user);
  }

  @Get('my-applications')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get current student applications' })
  async getMyApplications(@CurrentUser() user: User) {
    return this.housingService.findApplicationsByUser(user);
  }

  @Patch('applications/:id/status')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Approve or reject an application' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.housingService.updateApplicationStatus(id, dto.status);
  }
}
