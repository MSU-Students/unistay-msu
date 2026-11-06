import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum GigStatus {
  OPEN = 'open',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('student_gigs')
export class Gig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ default: 'General' })
  category: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  compensationAmount: number;

  @Column({ nullable: true })
  locationNote?: string;

  @Column({
    type: 'enum',
    enum: GigStatus,
    default: GigStatus.OPEN,
  })
  status: GigStatus;

  @ManyToOne(() => User, { eager: true })
  postedBy: User;

  @ManyToOne(() => User, { nullable: true, eager: true })
  assignedTo?: User;

  @OneToMany(() => GigApplication, (app) => app.gig, { cascade: true })
  applications: GigApplication[];

  @OneToMany(() => GigStatusLog, (log) => log.gig, { cascade: true })
  statusLogs: GigStatusLog[];

  @OneToMany(() => GigNote, (note) => note.gig, { cascade: true })
  notes: GigNote[];

  @Column({ type: 'timestamp', nullable: true })
  assignedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date;

  @Column({ type: 'text', nullable: true })
  cancellationReason?: string;

  @Column({ type: 'text', nullable: true })
  completionNote?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('gig_applications')
export class GigApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Gig, (gig) => gig.applications, { onDelete: 'CASCADE' })
  gig: Gig;

  @ManyToOne(() => User, { eager: true })
  applicant: User;

  @Column({ type: 'text', nullable: true })
  pitch?: string;

  @Column({ default: 'pending' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('gig_status_logs')
export class GigStatusLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Gig, (gig) => gig.statusLogs, { onDelete: 'CASCADE' })
  gig: Gig;

  @Column({
    type: 'enum',
    enum: GigStatus,
    nullable: true,
  })
  fromStatus?: GigStatus;

  @Column({
    type: 'enum',
    enum: GigStatus,
  })
  toStatus: GigStatus;

  @Column()
  action: string;

  @ManyToOne(() => User, { eager: true })
  changedBy: User;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('gig_notes')
export class GigNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Gig, (gig) => gig.notes, { onDelete: 'CASCADE' })
  gig: Gig;

  @ManyToOne(() => User, { eager: true })
  author: User;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
