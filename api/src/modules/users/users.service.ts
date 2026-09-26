import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async createOrUpdateOAuthUser(payload: {
    email: string;
    fullName: string;
    avatarUrl?: string;
    role?: Role;
  }): Promise<User> {
    let user = await this.findByEmail(payload.email);
    if (!user) {
      user = this.userRepository.create({
        email: payload.email,
        fullName: payload.fullName,
        avatarUrl: payload.avatarUrl,
        role: payload.role || Role.STUDENT,
        isInstitutionalVerified: payload.email.endsWith('@msu.edu.ph'),
      });
    } else {
      user.fullName = payload.fullName || user.fullName;
      user.avatarUrl = payload.avatarUrl || user.avatarUrl;
    }
    return this.userRepository.save(user);
  }

  async updateRole(id: string, role: Role): Promise<User> {
    const user = await this.findById(id);
    user.role = role;
    return this.userRepository.save(user);
  }
}
