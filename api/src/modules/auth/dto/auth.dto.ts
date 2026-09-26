import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

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
