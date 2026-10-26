import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Property, Unit } from './property.entity';

export enum ApplicationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export interface ApplicationStatusHistoryEntry {
  status: ApplicationStatus;
  changedAt: string;
  changedBy: string;
}

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
  applicant: User;

  @ManyToOne(() => Property, { eager: true })
  property: Property;

  @ManyToOne(() => Unit, { nullable: true, eager: true })
  unit?: Unit;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.PENDING,
  })
  status: ApplicationStatus;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  statusHistory: ApplicationStatusHistoryEntry[];

  @Column({ default: false })
  policyException: boolean;

  @Column({ type: 'text', nullable: true })
  policyExceptionReason?: string | null;

  @Column({ default: false })
  escalated: boolean;

  @Column({ type: 'text', nullable: true })
  escalationReason?: string | null;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('leases')
export class Lease {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
  tenant: User;

  @ManyToOne(() => Unit, { eager: true })
  unit: Unit;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate?: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monthlyRate: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
