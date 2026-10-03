import { Injectable, Logger } from '@nestjs/common';
import { BatchSyncDto, SyncActionType } from './dto/sync.dto';
import { BillingService } from '../billing/billing.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { FacilitiesService } from '../facilities/facilities.service';
import { GigsService } from '../gigs/gigs.service';
import { User } from '../users/entities/user.entity';

export interface SyncResultItem {
  clientMutationId: string;
  success: boolean;
  error?: string;
  data?: any;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly maintenanceService: MaintenanceService,
    private readonly facilitiesService: FacilitiesService,
    private readonly gigsService: GigsService,
  ) {}

  async processBatchSync(dto: BatchSyncDto, user: User) {
    const results: SyncResultItem[] = [];

    for (const item of dto.items) {
      try {
        let resultData: any;
        switch (item.action) {
          case SyncActionType.CREATE_PAYMENT:
            resultData = await this.billingService.recordPayment(item.payload as any, user);
            break;
          case SyncActionType.CREATE_TICKET:
            resultData = await this.maintenanceService.createTicket(item.payload as any, user);
            break;
          case SyncActionType.CREATE_BOOKING:
            resultData = await this.facilitiesService.createBooking(item.payload as any, user);
            break;
          case SyncActionType.CREATE_GIG_APPLICATION:
            resultData = await this.gigsService.applyForGig(
              item.payload.gigId,
              { pitch: item.payload.pitch },
              user,
            );
            break;
          default:
            throw new Error(`Unsupported sync action: ${item.action}`);
        }

        results.push({
          clientMutationId: item.clientMutationId,
          success: true,
          data: resultData,
        });
      } catch (err: any) {
        this.logger.error(`Error processing sync item ${item.clientMutationId}: ${err?.message || err}`);
        results.push({
          clientMutationId: item.clientMutationId,
          success: false,
          error: err?.message || String(err),
        });
      }
    }

    return {
      syncedCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      timestamp: new Date().toISOString(),
      results,
    };
  }
}
