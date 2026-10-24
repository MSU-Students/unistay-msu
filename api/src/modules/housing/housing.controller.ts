import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HousingService } from './housing.service';
import {
  CreateApplicationDto,
  CreatePropertyDto,
  UpdateApplicationStatusDto,
  UpdatePropertyDto,
} from './dto/housing.dto';
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

  @Get('manager/properties')
  @Roles(Role.PROPERTY_MANAGER)
  @ApiOperation({ summary: 'List properties assigned to the current manager' })
  async getManagedProperties(@CurrentUser() user: User) {
    return this.housingService.findPropertiesAssignedToManager(user.id);
  }

  @Get('manager/tenants')
  @Roles(Role.PROPERTY_MANAGER)
  @ApiOperation({ summary: "List current tenants in the manager's properties" })
  async getManagedTenants(@CurrentUser() user: User) {
    return this.housingService.findTenantsAssignedToManager(user.id);
  }

  @Get('manager/applications')
  @Roles(Role.PROPERTY_MANAGER)
  @ApiOperation({ summary: "List applications for the manager's properties" })
  async getManagedApplications(@CurrentUser() user: User) {
    return this.housingService.findApplicationsForManager(user.id);
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

  @Patch('properties/:id')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Update a property/dormitory listing' })
  async updateProperty(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.housingService.updateProperty(id, dto);
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

  @Get('applications/:id')
  @Roles(Role.STUDENT, Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Get a housing application by ID' })
  async getApplicationById(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.housingService.findApplicationById(
      id,
      user.role === Role.STUDENT ? user.id : undefined,
    );
  }

  @Get('my-applications')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get current student applications' })
  async getMyApplications(@CurrentUser() user: User) {
    return this.housingService.findApplicationsByUser(user);
  }

  @Get('my-residence')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get current assigned dormitory property and room for logged-in student' })
  async getMyResidence(@CurrentUser() user: User) {
    return this.housingService.getMyResidence(user);
  }
  @Get('applications/review')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({
    summary: 'List applications for manager review',
    description:
      'Returns applications newest first with applicant name/email, property name, optional unit room, status, remarks, and submission date. Property managers only see applications for their properties; university admins see all applications.',
  })
  async getApplicationsForReview(@CurrentUser() user: User) {
    return this.housingService.findApplicationsForReview(user);
  }

  @Patch('applications/:id/status')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Approve or reject an application' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.housingService.updateApplicationStatus(id, dto.status, user);
  }
}

