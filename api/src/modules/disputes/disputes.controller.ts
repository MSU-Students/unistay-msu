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
import { DisputesService } from './disputes.service';
import {
  CreateDisputeDto,
  RespondToDisputeDto,
  ResolveDisputeDto,
  DisputeActionDto,
} from './dto/disputes.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@ApiTags('Dispute Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  @ApiOperation({ summary: 'List disputes' })
  async findAll(@CurrentUser() user: User) {
    if (user.role === Role.STUDENT) {
      return this.disputesService.findAll(user.id);
    }

    return this.disputesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'View dispute details and action history' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.disputesService.findById(
      id,
      user.role === Role.STUDENT ? user.id : undefined,
    );
  }

  @Post()
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Submit a dispute about a student gig' })
  async create(
    @Body() dto: CreateDisputeDto,
    @CurrentUser() user: User,
  ) {
    return this.disputesService.create(dto, user);
  }

  @Patch(':id/respond')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Respond to a dispute' })
  async respond(
    @Param('id') id: string,
    @Body() dto: RespondToDisputeDto,
    @CurrentUser() user: User,
  ) {
    return this.disputesService.respond(id, dto, user);
  }

  @Patch(':id/escalate')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Escalate a dispute' })
  async escalate(
    @Param('id') id: string,
    @Body() dto: DisputeActionDto,
    @CurrentUser() user: User,
  ) {
    return this.disputesService.escalate(id, dto, user);
  }

  @Patch(':id/resolve')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Resolve a dispute' })
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
    @CurrentUser() user: User,
  ) {
    return this.disputesService.resolve(id, dto, user);
  }

  @Patch(':id/close')
  @Roles(Role.PROPERTY_MANAGER, Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Close a dispute' })
  async close(
    @Param('id') id: string,
    @Body() dto: DisputeActionDto,
    @CurrentUser() user: User,
  ) {
    return this.disputesService.close(id, dto, user);
  }
}
