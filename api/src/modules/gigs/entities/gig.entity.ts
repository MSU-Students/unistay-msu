import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { User } from '../users/entities/user.entity';

export enum GigStatus {
  OPEN = 'open',
  ASSIGNED = 'assigned',
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
  category: string; // 'Laundry Service' | 'Delivery' | 'Tutoring' | 'Cleaning'

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

  @Column({ default: 'pending' }) // 'pending' | 'accepted' | 'declined'
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
