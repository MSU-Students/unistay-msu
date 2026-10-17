import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from './entities/user.entity';

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

  @Get(':id')
  @ApiOperation({ summary: 'Get user details by ID' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
  ): Promise<User> {
    if (currentUser.role === Role.STUDENT && currentUser.id !== id) {
      throw new ForbiddenException('Students can only access their own user information');
    }
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
