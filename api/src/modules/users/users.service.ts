import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
    return this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('LOWER(user.email) = LOWER(:email)', { email: email.toLowerCase() })
      .getOne();
  }

  async findByStudentIdNumber(studentIdNumber: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { studentIdNumber },
    });
  }

  async createStudent(payload: {
    email: string;
    passwordHash: string;
    fullName: string;
    studentIdNumber?: string;
    college?: string;
    course?: string;
    phoneNumber?: string;
    nickName?: string;
  }): Promise<User> {
    const normalizedEmail = payload.email.trim().toLowerCase();

    // Check duplicate email
    const existingEmail = await this.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw new ConflictException('An account with this email address already exists.');
    }

    // Check duplicate studentIdNumber if provided
    if (payload.studentIdNumber && payload.studentIdNumber.trim()) {
      const existingStudentId = await this.findByStudentIdNumber(payload.studentIdNumber.trim());
      if (existingStudentId) {
        throw new ConflictException('A student account with this Student ID Number already exists.');
      }
    }

    const isInstitutionalVerified = normalizedEmail.endsWith('@msu.edu.ph');

    const user = this.userRepository.create({
      email: normalizedEmail,
      password: payload.passwordHash,
      fullName: payload.fullName.trim(),
      studentIdNumber: payload.studentIdNumber?.trim() || undefined,
      college: payload.college?.trim() || undefined,
      course: payload.course?.trim() || undefined,
      phoneNumber: payload.phoneNumber?.trim() || undefined,
      nickName: payload.nickName?.trim() || undefined,
      role: Role.STUDENT, // Strictly enforced student role for self-registration
      isActive: true,
      isInstitutionalVerified,
    });

    const savedUser = await this.userRepository.save(user);
    // Return user without password
    const { password, ...userWithoutPassword } = savedUser;
    return userWithoutPassword as User;
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
