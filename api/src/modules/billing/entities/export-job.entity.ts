import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ExportJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('export_jobs')
export class ExportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: string; // e.g., 'finance_summary'

  @Column({ type: 'jsonb', nullable: true })
  filters: any;

  @Column({ type: 'varchar', default: ExportJobStatus.PENDING })
  status: ExportJobStatus;

  @Column({ type: 'varchar', nullable: true })
  format: string; // csv, xlsx, pdf

  @Column({ type: 'varchar', nullable: true })
  objectKey?: string; // object name in MinIO

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
