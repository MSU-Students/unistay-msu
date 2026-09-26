import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { BatchSyncDto } from './dto/sync.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Offline Sync Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('batch')
  @ApiOperation({ summary: 'Replay client-side Dexie.js offline mutation queue upon reconnect' })
  async syncBatch(
    @Body() dto: BatchSyncDto,
    @CurrentUser() user: User,
  ) {
    return this.syncService.processBatchSync(dto, user);
  }
}
