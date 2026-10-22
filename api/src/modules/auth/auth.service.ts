import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { DevLoginDto, LoginDto, RegisterDto } from './dto/auth.dto';

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
        nickName: user.nickName,
        studentIdNumber: user.studentIdNumber,
        college: user.college,
        course: user.course,
        phoneNumber: user.phoneNumber,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isInstitutionalVerified: user.isInstitutionalVerified,
      },
    };
  }

  async register(dto: RegisterDto) {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.usersService.createStudent({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      studentIdNumber: dto.studentIdNumber,
      college: dto.college,
      course: dto.course,
      phoneNumber: dto.phoneNumber,
      nickName: dto.nickName,
    });

    return this.generateToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account has been deactivated. Please contact campus administration.',
      );
    }

    return this.generateToken(user);
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

