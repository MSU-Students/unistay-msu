import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import {
  Invoice,
  InvoiceAuditAction,
  InvoiceAuditActorType,
  InvoiceAuditLog,
} from './entities/invoice.entity';

export interface AuditRequestMetadata {
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
}

@Injectable()
export class AuditService {
  async logAction(
    manager: EntityManager,
    invoice: Invoice,
    action: InvoiceAuditAction,
    actor: User,
    metadata: AuditRequestMetadata = {},
  ): Promise<InvoiceAuditLog> {
    const actorType = actor.role === Role.UNIVERSITY_ADMIN
      ? InvoiceAuditActorType.UNIVERSITY_ADMIN
      : actor.role === Role.STUDENT
        ? InvoiceAuditActorType.TENANT
        : InvoiceAuditActorType.PROPERTY_MANAGER;
    const log = manager.getRepository(InvoiceAuditLog).create({
      invoice,
      action,
      actorId: actor.id,
      actorType,
      snapshot: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        actor: {
          id: actor.id,
          fullName: actor.fullName,
          email: actor.email,
          role: actor.role,
        },
        propertyId: invoice.property?.id,
        propertyName: invoice.property?.name,
        tenantId: invoice.tenant?.id,
        tenantName: invoice.tenant?.fullName,
        tenantEmail: invoice.tenant?.email,
        leaseId: invoice.lease?.id ?? null,
        billingPeriodStart: invoice.billingPeriodStart ?? null,
        billingPeriodEnd: invoice.billingPeriodEnd ?? null,
        dueDate: invoice.dueDate,
        subtotal: Number(invoice.subtotal),
        tax: Number(invoice.tax),
        totalAmount: Number(invoice.totalAmount),
        paidAmount: Number(invoice.paidAmount),
        rentAmount: Number(invoice.rentAmount),
        electricityAmount: Number(invoice.electricityAmount),
        waterAmount: Number(invoice.waterAmount),
        otherFees: Number(invoice.otherFees),
        unitId: invoice.unit?.id ?? null,
        status: invoice.status,
        utilitySplitNotes: invoice.utilitySplitNotes ?? null,
        createdById: invoice.createdBy?.id ?? null,
        createdBy: invoice.createdBy
          ? {
            id: invoice.createdBy.id,
            fullName: invoice.createdBy.fullName,
            email: invoice.createdBy.email,
            role: invoice.createdBy.role,
          }
          : null,
        createdAt: invoice.createdAt ?? null,
        updatedAt: invoice.updatedAt ?? null,
        items: (invoice.items ?? []).map((item) => ({
          id: item.id,
          description: item.description,
          category: item.category,
          amount: Number(item.amount),
        })),
      },
      metadata: {
        ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
        ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
        ...(metadata.notes ? { notes: metadata.notes } : {}),
      },
    });
    return manager.getRepository(InvoiceAuditLog).save(log);
  }
}
