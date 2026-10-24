import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceTicket, OutageReport, TicketActivity } from './entities/ticket.entity';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { HousingModule } from '../housing/housing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MaintenanceTicket, TicketActivity, OutageReport]),
    HousingModule,
  ],
  providers: [MaintenanceService],
  controllers: [MaintenanceController],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
