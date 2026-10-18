import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice, InvoiceAuditLog, InvoiceItem, Payment } from './entities/invoice.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { InvoiceController, PropertyInvoiceController } from './invoice-management.controller';
import { AuditService } from './audit.service';
import { AuditSchemaService } from './audit-schema.service';
import { UtilitySplitterService } from './utility-splitter.service';
import { UsersModule } from '../users/users.module';
import { HousingModule } from '../housing/housing.module';
import { Lease } from '../housing/entities/application.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem, InvoiceAuditLog, Payment, Lease]),
    UsersModule,
    HousingModule,
  ],
  providers: [BillingService, AuditService, AuditSchemaService, UtilitySplitterService],
  controllers: [BillingController, PropertyInvoiceController, InvoiceController],
  exports: [BillingService, UtilitySplitterService],
})
export class BillingModule {}
