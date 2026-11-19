import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../../common/enums/role.enum';

export class DevLoginDto {
  @ApiProperty({ example: 'student@msu.edu.ph' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'Al-Rashid Macarambon' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ enum: Role, default: Role.STUDENT })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class GoogleAuthDto {
  @ApiProperty()
  @IsString()
  idToken: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'student.msu@msu.edu.ph', description: 'Student institutional or personal email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ example: 'SecurePassword123!', description: 'Student account password (min 6 characters)' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiProperty({ example: 'Amina Dimaporo', description: 'Student legal full name' })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @ApiPropertyOptional({ example: '2023-01234', description: 'MSU Student ID Number' })
  @IsOptional()
  @IsString()
  studentIdNumber?: string;

  @ApiPropertyOptional({ example: 'College of Natural Sciences and Mathematics (CNSM)', description: 'Affiliated MSU College' })
  @IsOptional()
  @IsString()
  college?: string;

  @ApiPropertyOptional({ example: 'BS Computer Science', description: 'Academic course or degree program' })
  @IsOptional()
  @IsString()
  course?: string;

  @ApiPropertyOptional({ example: '09123456789', description: 'Contact mobile number' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'Ami', description: 'Preferred nickname' })
  @IsOptional()
  @IsString()
  nickName?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'student.msu@msu.edu.ph', description: 'Registered email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ example: 'SecurePassword123!', description: 'Account password' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

