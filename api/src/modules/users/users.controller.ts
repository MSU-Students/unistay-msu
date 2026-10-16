import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  UseGuards,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from './entities/user.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserStatusDto,
} from './dto/manage-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get profile of authenticated user' })
  async getProfile(@CurrentUser() user: any) {
    return this.usersService.findById(user.id);
  }

  @Get()
  @Roles(Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'List all users (Admin only)' })
  async findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Post()
  @Roles(Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Create a user (Admin only)' })
  @ApiCreatedResponse({ type: User })
  async create(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Update user details (Admin only)' })
  @ApiOkResponse({ type: User })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Update user active status (Admin only)' })
  @ApiOkResponse({ type: User })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<User> {
    return this.usersService.updateStatus(id, dto.isActive);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user details by ID' })
  async findOne(@Param('id') id: string): Promise<User> {
    return this.usersService.findById(id);
  }

  @Patch(':id/role')
  @Roles(Role.UNIVERSITY_ADMIN)
  @ApiOperation({ summary: 'Update user role (Admin only)' })
  async updateRole(
    @Param('id') id: string,
    @Body('role') role: Role,
  ): Promise<User> {
    return this.usersService.updateRole(id, role);
  }
}
