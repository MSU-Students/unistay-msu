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
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export interface ApplicationPersonalDetails {
  fullName: string;
  email: string;
  studentIdNumber?: string;
  phoneNumber?: string;
}

export interface ApplicationAcademicDetails {
  college?: string;
  course?: string;
}

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
  applicant: User;

  @ManyToOne(() => Property, { nullable: true, eager: true })
  property?: Property;

  @ManyToOne(() => Unit, { nullable: true, eager: true })
  unit?: Unit;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.PENDING,
  })
  status: ApplicationStatus;

  @Column({ type: 'jsonb', nullable: true })
  personalDetails?: ApplicationPersonalDetails;

  @Column({ type: 'jsonb', nullable: true })
  academicDetails?: ApplicationAcademicDetails;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt?: Date;

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
