import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum PropertyType {
  INSTITUTIONAL_DORM = 'institutional_dorm',
  PRIVATE_BOARDING_HOUSE = 'private_boarding_house',
}

@Entity('properties')
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: PropertyType,
    default: PropertyType.INSTITUTIONAL_DORM,
  })
  type: PropertyType;

  @Column({ type: 'text' })
  description: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  proximityToCollege?: string;

  @Column('simple-array', { nullable: true })
  amenities: string[];

  @Column('simple-array', { nullable: true })
  photos: string[];

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  minMonthlyRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  maxMonthlyRate: number;

  @Column({ default: true })
  isAccredited: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  manager: User;

  @OneToMany(() => Unit, (unit) => unit.property, { cascade: true })
  units: Unit[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('units')
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  roomNumber: string;

  @Column({ default: 1 })
  capacity: number;

  @Column({ default: 0 })
  occupiedCount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monthlyRent: number;

  @Column({ default: true })
  isAvailable: boolean;

  @ManyToOne(() => Property, (property) => property.units, { onDelete: 'CASCADE' })
  property: Property;

  @CreateDateColumn()
  createdAt: Date;
}
