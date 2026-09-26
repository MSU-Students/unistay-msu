import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Property } from '../housing/entities/property.entity';

export enum FacilityType {
  LAUNDRY = 'laundry',
  PARKING = 'parking',
  STUDY_HALL = 'study_hall',
  RECREATION = 'recreation',
}

@Entity('facilities')
export class Facility {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: FacilityType,
  })
  type: FacilityType;

  @ManyToOne(() => Property, { eager: true })
  property: Property;

  @Column({ default: 1 })
  slotCapacity: number;

  @Column({ default: '06:00 - 22:00' })
  operationalHours: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

export enum BookingStatus {
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

@Entity('facility_bookings')
export class FacilityBooking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Facility, { eager: true })
  facility: Facility;

  @ManyToOne(() => User, { eager: true })
  user: User;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp' })
  endTime: Date;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.CONFIRMED,
  })
  status: BookingStatus;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('incident_reports')
export class IncidentReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ default: 'medium' })
  severity: string;

  @ManyToOne(() => Property, { eager: true })
  property: Property;

  @ManyToOne(() => User, { eager: true })
  reporter: User;

  @Column({ default: 'open' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('dorm_rules')
export class DormRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: 'General' })
  category: string;

  @ManyToOne(() => Property, { nullable: true })
  property?: Property;

  @CreateDateColumn()
  createdAt: Date;
}
