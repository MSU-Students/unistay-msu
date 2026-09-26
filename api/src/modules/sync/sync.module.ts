import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { BillingModule } from '../billing/billing.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { FacilitiesModule } from '../facilities/facilities.module';
import { GigsModule } from '../gigs/gigs.module';

@Module({
  imports: [BillingModule, MaintenanceModule, FacilitiesModule, GigsModule],
  providers: [SyncService],
  controllers: [SyncController],
  exports: [SyncService],
})
export class SyncModule {}
