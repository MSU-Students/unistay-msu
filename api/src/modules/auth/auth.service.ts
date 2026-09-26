import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { DevLoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async generateToken(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isInstitutionalVerified: user.isInstitutionalVerified,
      },
    };
  }

  async validateOAuthLogin(googleUser: {
    email: string;
    fullName: string;
    avatarUrl?: string;
  }) {
    const user = await this.usersService.createOrUpdateOAuthUser({
      email: googleUser.email,
      fullName: googleUser.fullName,
      avatarUrl: googleUser.avatarUrl,
    });
    return this.generateToken(user);
  }

  async devLogin(dto: DevLoginDto) {
    const user = await this.usersService.createOrUpdateOAuthUser({
      email: dto.email,
      fullName: dto.fullName || 'MSU Resident',
      role: dto.role || Role.STUDENT,
    });
    return this.generateToken(user);
  }
}
