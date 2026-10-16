import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { Role } from '../../../common/enums/role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'student@msu.edu.ph' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Al-Rashid Macarambon' })
  @IsString()
  fullName: string;

  @ApiProperty({ enum: Role, example: Role.STUDENT })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({ example: 'College of Natural Sciences and Mathematics' })
  @IsOptional()
  @IsString()
  college?: string;

  @ApiPropertyOptional({ example: 'BS Computer Science' })
  @IsOptional()
  @IsString()
  course?: string;

  @ApiPropertyOptional({ example: '2024-12345' })
  @IsOptional()
  @IsString()
  studentIdNumber?: string;

  @ApiPropertyOptional({ example: '+63 912 345 6789' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'student@msu.edu.ph' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Al-Rashid Macarambon' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ enum: Role, example: Role.STUDENT })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ example: 'College of Natural Sciences and Mathematics' })
  @IsOptional()
  @IsString()
  college?: string;

  @ApiPropertyOptional({ example: 'BS Computer Science' })
  @IsOptional()
  @IsString()
  course?: string;

  @ApiPropertyOptional({ example: '2024-12345' })
  @IsOptional()
  @IsString()
  studentIdNumber?: string;

  @ApiPropertyOptional({ example: '+63 912 345 6789' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

export class UpdateUserStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive: boolean;
}
