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

export interface HousingEmergencyContact {
  fullName: string;
  relationship: string;
  contactNumber: string;
}

export interface HousingPersonalDetails {
  fullName: string;
  dateOfBirth: string;
  email: string;
  contactNumber: string;
  address: string;
  emergencyContact: HousingEmergencyContact;
}

export interface HousingAcademicDetails {
  studentIdNumber: string;
  degreeProgram: string;
  yearLevel: number;
  college: string;
}

export interface HousingPreferences {
  preferredDorm: string;
  preferredUnitType: string;
  roommatePreferences: string;
}

export interface HousingSupportingDocument {
  key: string;
  url?: string;
  fileName?: string;
  contentType?: string;
}

@Entity('housing_applications')
@Index(['studentId', 'createdAt'])
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

  @Column({ type: 'jsonb', nullable: true })
  personalDetails?: Omit<Partial<HousingPersonalDetails>, 'emergencyContact'> & {
    emergencyContact?: Partial<HousingEmergencyContact>;
  };

  @Column({ type: 'jsonb', nullable: true })
  academicDetails?: Partial<HousingAcademicDetails>;

  @Column({ type: 'jsonb', nullable: true })
  housingPreferences?: Partial<HousingPreferences>;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  supportingDocuments: HousingSupportingDocument[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt?: Date;
}
