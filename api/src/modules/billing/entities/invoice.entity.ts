import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Property, Unit } from '../../housing/entities/property.entity';
import { Lease } from '../../housing/entities/application.entity';

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  VOIDED = 'VOIDED',
}

export enum InvoiceItemCategory {
  RENT = 'RENT',
  UTILITY = 'UTILITY',
  PARKING = 'PARKING',
  LATE_FEE = 'LATE_FEE',
}

export enum InvoiceAuditAction {
  GENERATED = 'GENERATED',
  ISSUED = 'ISSUED',
  STATUS_UPDATED = 'STATUS_UPDATED',
  ITEM_ADDED = 'ITEM_ADDED',
  VOIDED = 'VOIDED',
}

export enum InvoiceAuditActorType {
  PROPERTY_MANAGER = 'PROPERTY_MANAGER',
  UNIVERSITY_ADMIN = 'UNIVERSITY_ADMIN',
  TENANT = 'TENANT',
  SYSTEM_CRON = 'SYSTEM_CRON',
}

@Entity('invoices')
@Index('uq_invoice_property_tenant_period', ['property', 'tenant', 'billingPeriodStart', 'billingPeriodEnd'], {
  unique: true,
  where: '"createdById" IS NOT NULL AND "status" <> \'VOIDED\'',
})
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  invoiceNumber: string;

  @ManyToOne(() => User, { eager: true })
  tenant: User;

  @ManyToOne(() => Property, { eager: true })
  property: Property;

  @ManyToOne(() => Lease, { nullable: true })
  lease?: Lease;

  @ManyToOne(() => Unit, { nullable: true, eager: true })
  unit?: Unit;

  @Column({ type: 'date', nullable: true })
  billingPeriodStart?: Date;

  @Column({ type: 'date', nullable: true })
  billingPeriodEnd?: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tax: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  paidAmount: number;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @Column({ type: 'date' })
  dueDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  rentAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  electricityAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  waterAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  otherFees: number;

  @Column({ type: 'text', nullable: true })
  utilitySplitNotes?: string;

  @ManyToOne(() => User, { nullable: true })
  createdBy?: User;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: ['insert'] })
  items: InvoiceItem[];

  @OneToMany(() => InvoiceAuditLog, (entry) => entry.invoice)
  auditLogs: InvoiceAuditLog[];

  @OneToMany(() => Payment, (payment) => payment.invoice, { cascade: true })
  payments: Payment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('invoice_items')
@Index('idx_invoice_items_invoice_id', ['invoice'])
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  invoice: Invoice;

  @Column()
  description: string;

  @Column({ type: 'enum', enum: InvoiceItemCategory })
  category: InvoiceItemCategory;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;
}

@Entity('invoice_audit_logs')
@Index('idx_invoice_audit_logs_invoice_created', ['invoice', 'createdAt'])
@Index('idx_invoice_audit_logs_created_at', ['createdAt'])
export class InvoiceAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.auditLogs, { onDelete: 'RESTRICT' })
  invoice: Invoice;

  @Column({ type: 'enum', enum: InvoiceAuditAction })
  action: InvoiceAuditAction;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor?: User;

  @Column({ type: 'enum', enum: InvoiceAuditActorType })
  actorType: InvoiceAuditActorType;

  @Column({ type: 'jsonb' })
  snapshot: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

export enum PaymentMethod {
  CASH = 'cash',
  GCASH = 'gcash',
  BANK_TRANSFER = 'bank_transfer',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  offlineReferenceId?: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.payments, { onDelete: 'CASCADE' })
  invoice: Invoice;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
  })
  paymentMethod: PaymentMethod;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  paymentDate: Date;

  @Column({ nullable: true })
  receiptUrl?: string;

  @Column({ default: true })
  isSynced: boolean;

  @ManyToOne(() => User, { nullable: true })
  recordedBy?: User;

  @CreateDateColumn()
  createdAt: Date;
}
