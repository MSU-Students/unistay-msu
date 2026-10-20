import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from '../housing/entities/application.entity';
import { Invoice } from '../billing/entities/invoice.entity';
import { MaintenanceTicket } from '../maintenance/entities/ticket.entity';
import { Gig } from '../gigs/entities/gig.entity';
import { Property, Unit } from '../housing/entities/property.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Application,
      Invoice,
      MaintenanceTicket,
      Gig,
      Property,
      Unit,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
