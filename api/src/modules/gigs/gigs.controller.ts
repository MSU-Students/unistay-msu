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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { GigsService } from './gigs.service';
import {
  ApplyForGigDto,
  CreateGigDto,
  CreateGigNoteDto,
  UpdateGigStatusDto,
  GigQueryDto,
} from './dto/gigs.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@ApiTags('Student Gig Board')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gigs')
export class GigsController {
  constructor(private readonly gigsService: GigsService) { }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Browse micro-job opportunities' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['open', 'assigned', 'in_progress', 'completed', 'cancelled'] })
  async getGigs(@Query() query: GigQueryDto) {
    return this.gigsService.findAllGigs(query.category, query.status);
  }

  @Get('my/posted')
  @Roles(Role.STUDENT, Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Get all gigs posted by current authenticated user' })
  async getMyPostedGigs(@CurrentUser() user: User) {
    return this.gigsService.findMyPostedGigs(user);
  }

  @Get('my/assigned')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get all gigs assigned to current student worker' })
  async getMyAssignedGigs(@CurrentUser() user: User) {
    return this.gigsService.findMyAssignedGigs(user);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get single gig details with status logs and notes' })
  async getGigById(@Param('id') id: string) {
    return this.gigsService.findGigById(id);
  }

  @Public()
  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get chronological activity and status transition timeline for a gig' })
  async getGigTimeline(@Param('id') id: string) {
    return this.gigsService.getGigTimeline(id);
  }

  @Get(':id/notes')
  @Roles(Role.STUDENT, Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Get communication notes and messages attached to a gig' })
  async getGigNotes(@Param('id') id: string) {
    return this.gigsService.getGigNotes(id);
  }

  @Post(':id/notes')
  @Roles(Role.STUDENT, Role.PROPERTY_MANAGER)
  @ApiOperation({ summary: 'Attach a message or note to a gig request' })
  async addGigNote(
    @Param('id') id: string,
    @Body() dto: CreateGigNoteDto,
    @CurrentUser() user: User,
  ) {
    return this.gigsService.addGigNote(id, dto, user);
  }

  @Post()
  @Roles(Role.STUDENT, Role.PROPERTY_MANAGER)
  @ApiOperation({ summary: 'Post an errand or task gig' })
  async createGig(
    @Body() dto: CreateGigDto,
    @CurrentUser() user: User,
  ) {
    return this.gigsService.createGig(dto, user);
  }

  @Post(':id/apply')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Apply for a micro-job / errand' })
  async applyForGig(
    @Param('id') gigId: string,
    @Body() dto: ApplyForGigDto,
    @CurrentUser() user: User,
  ) {
    return this.gigsService.applyForGig(gigId, dto, user);
  }

  @Post(':id/assign/:applicantId')
  @Roles(Role.STUDENT, Role.PROPERTY_MANAGER)
  @ApiOperation({ summary: 'Assign gig to an applicant' })
  async assignGig(
    @Param('id') gigId: string,
    @Param('applicantId') applicantId: string,
    @CurrentUser() user: User,
  ) {
    return this.gigsService.assignGig(gigId, applicantId, user);
  }

  @Patch(':id/status')
  @Roles(Role.STUDENT, Role.PROPERTY_MANAGER)
  @ApiOperation({ summary: 'Update gig lifecycle status (in_progress, completed, cancelled)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGigStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.gigsService.updateGigStatus(id, dto, user);
  }
}

