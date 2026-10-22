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
import {
  CreateApplicationDto,
  CreatePropertyDto,
  SaveApplicationDraftDto,
  UpdateApplicationStatusDto,
} from './dto/housing.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import {
  CreateDraftApplicationDto,
  SubmitApplicationDto,
  UpdateApplicationDto,
} from './dto/housing-application.dto';

@ApiTags('Housing & Dormitories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('housing')
export class HousingController {
  constructor(private readonly housingService: HousingService) {}

  @Post('applications/draft')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Create or update the current housing application draft' })
  async createApplicationDraft(
    @Body() dto: CreateDraftApplicationDto,
    @CurrentUser() user: User,
  ) {
    return this.housingService.createHousingApplicationDraft(dto, user);
  }

  @Patch('applications/:id/draft')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Update a housing application draft' })
  async patchApplicationDraft(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
    @CurrentUser() user: User,
  ) {
    return this.housingService.updateHousingApplicationDraft(id, dto, user);
  }

  @Post('applications/:id/submit')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Submit a completed housing application' })
  async submitHousingApplication(
    @Param('id') id: string,
    @Body() dto: SubmitApplicationDto,
    @CurrentUser() user: User,
  ) {
    return this.housingService.submitHousingApplication(id, dto, user);
  }

  @Get('applications/my-application')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: "Get the student's current housing application" })
  async getMyHousingApplication(@CurrentUser() user: User) {
    return this.housingService.findMyHousingApplication(user);
  }

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
    return this.housingService.submitApplication(dto, user);
  }

  @Post('applications/drafts')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Save a housing application as a draft' })
  async saveApplicationDraft(
    @Body() dto: SaveApplicationDraftDto,
    @CurrentUser() user: User,
  ) {
    return this.housingService.saveApplicationDraft(dto, user);
  }

  @Patch('applications/:id/submit')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Validate and submit a saved housing application draft' })
  async submitApplicationDraft(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: SaveApplicationDraftDto = {},
  ) {
    return this.housingService.submitApplicationDraft(id, dto, user);
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
