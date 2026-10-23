import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum HousingApplicationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface HousingApplicationDocument {
  storageKey: string;
  fileName: string;
  contentType: string;
  size: number;
  url: string;
}

@Entity('housing_applications')
@Index(['studentId', 'status'])
export class HousingApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  studentId: string;

  @Column({
    type: 'enum',
    enum: HousingApplicationStatus,
    default: HousingApplicationStatus.DRAFT,
  })
  status: HousingApplicationStatus;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  personalDetails: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  academicDetails: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  housingPreferences: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  supportingDocuments: HousingApplicationDocument[];

  @Column({ type: 'varchar', nullable: true, unique: true })
  confirmationCode?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt?: Date;
}