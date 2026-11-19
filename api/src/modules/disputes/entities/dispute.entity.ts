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
import { Gig } from '../../gigs/entities/gig.entity';

export enum DisputeStatus {
  OPEN = 'open',
  IN_REVIEW = 'in_review',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum DisputeActionType {
  SUBMITTED = 'submitted',
  RESPONDED = 'responded',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Gig, { eager: true, nullable: false })
  gig: Gig;

  @ManyToOne(() => User, { eager: true, nullable: false })
  reportedBy: User;

  @ManyToOne(() => User, { nullable: true, eager: true })
  assignedManager?: User;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
  })
  status: DisputeStatus;

  @Column({ type: 'text', nullable: true })
  resolution?: string;

  @OneToMany(() => DisputeAction, (action) => action.dispute)
  actions: DisputeAction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('dispute_actions')
export class DisputeAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Dispute, (dispute) => dispute.actions, {
    onDelete: 'CASCADE',
  })
  dispute: Dispute;

  @ManyToOne(() => User, { eager: true, nullable: false })
  performedBy: User;

  @Column({
    type: 'enum',
    enum: DisputeActionType,
  })
  actionType: DisputeActionType;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn()
  createdAt: Date;
}
