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
import { GigsService } from './gigs.service';
import { ApplyForGigDto, CreateGigDto, UpdateGigStatusDto } from './dto/gigs.dto';
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
  constructor(private readonly gigsService: GigsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Browse micro-job opportunities' })
  async getGigs(@Query('category') category?: string) {
    return this.gigsService.findAllGigs(category);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get single gig details' })
  async getGigById(@Param('id') id: string) {
    return this.gigsService.findGigById(id);
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
  @ApiOperation({ summary: 'Update gig status (e.g. mark completed)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGigStatusDto,
  ) {
    return this.gigsService.updateGigStatus(id, dto);
  }
}
