import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../../common/enums/role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  fullName: string;

  @Column({nullable: true})
  nickName: string;

  @Column({ nullable: true })
  studentIdNumber?: string;

  @Column({ nullable: true })
  avatarUrl?: string;

  @Column({ nullable: true })
  college?: string;

  @Column({ nullable: true })
  course?: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.STUDENT,
  })
  role: Role;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isInstitutionalVerified: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
