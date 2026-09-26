import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export enum SyncActionType {
  CREATE_PAYMENT = 'CREATE_PAYMENT',
  CREATE_TICKET = 'CREATE_TICKET',
  CREATE_BOOKING = 'CREATE_BOOKING',
  CREATE_GIG_APPLICATION = 'CREATE_GIG_APPLICATION',
}

export class SyncQueueItemDto {
  @ApiProperty({ example: 'sync_item_1727312345_1' })
  @IsString()
  clientMutationId: string;

  @ApiProperty({ enum: SyncActionType })
  @IsEnum(SyncActionType)
  action: SyncActionType;

  @ApiProperty()
  @IsObject()
  payload: Record<string, any>;

  @ApiProperty({ example: '2026-09-26T08:00:00Z' })
  @IsString()
  queuedAt: string;
}

export class BatchSyncDto {
  @ApiProperty({ type: [SyncQueueItemDto] })
  @IsArray()
  items: SyncQueueItemDto[];

  @ApiProperty({ example: '2026-09-26T00:00:00Z', required: false })
  @IsOptional()
  @IsString()
  lastSyncTimestamp?: string;
}
