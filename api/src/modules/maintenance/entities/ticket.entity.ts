import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Property, Unit } from '../housing/entities/property.entity';

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum TicketCategory {
  PLUMBING = 'plumbing',
  ELECTRICAL = 'electrical',
  SANITATION = 'sanitation',
  CARPENTRY = 'carpentry',
  OTHER = 'other',
}

@Entity('maintenance_tickets')
export class MaintenanceTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: TicketCategory,
    default: TicketCategory.OTHER,
  })
  category: TicketCategory;

  @Column({
    type: 'enum',
    enum: TicketPriority,
    default: TicketPriority.MEDIUM,
  })
  priority: TicketPriority;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.OPEN,
  })
  status: TicketStatus;

  @Column('simple-array', { nullable: true })
  photoUrls: string[];

  @ManyToOne(() => User, { eager: true })
  reporter: User;

  @ManyToOne(() => Property, { eager: true })
  property: Property;

  @ManyToOne(() => Unit, { nullable: true, eager: true })
  unit?: Unit;

  @Column({ type: 'text', nullable: true })
  resolutionNotes?: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('outage_reports')
export class OutageReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  utilityType: string; // 'Water' | 'Electricity' | 'Internet'

  @Column({ type: 'text' })
  affectedArea: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  estimatedRestoration?: Date;

  @ManyToOne(() => User, { eager: true })
  reportedBy: User;

  @CreateDateColumn()
  createdAt: Date;
}
