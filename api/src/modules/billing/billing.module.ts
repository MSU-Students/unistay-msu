import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice, Payment } from './entities/invoice.entity';
import { Lease } from '../housing/entities/application.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { UtilitySplitterService } from './utility-splitter.service';
import { UsersModule } from '../users/users.module';
import { HousingModule } from '../housing/housing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, Payment, Lease]),
    UsersModule,
    HousingModule,
  ],
  providers: [BillingService, UtilitySplitterService],
  controllers: [BillingController],
  exports: [BillingService, UtilitySplitterService],
})
export class BillingModule {}
