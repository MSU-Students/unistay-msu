import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateDisputeDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID()
  gigId: string;

  @ApiProperty({ example: 'Payment dispute' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 'I completed the assigned gig but have not received payment.' })
  @IsString()
  @MinLength(10)
  description: string;
}

export class RespondToDisputeDto {
  @ApiProperty({ example: 'We are reviewing the reported issue.' })
  @IsString()
  @MinLength(3)
  message: string;
}

export class ResolveDisputeDto {
  @ApiProperty({ example: 'The payment issue has been verified and settled.' })
  @IsString()
  @MinLength(3)
  resolution: string;
}

export class DisputeActionDto {
  @ApiProperty({ example: 'The dispute requires further investigation.' })
  @IsString()
  @MinLength(3)
  message: string;
}
