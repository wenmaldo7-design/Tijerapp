import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StaffProfile } from './staff-profile.entity';

export enum DayOfWeek {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

@Entity('working_hours')
export class WorkingHours {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  staffProfileId: number;

  @ManyToOne(() => StaffProfile, (profile) => profile.workingHours, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'staffProfileId' })
  staffProfile: StaffProfile;

  @Column({ type: 'int' })
  dayOfWeek: DayOfWeek;

  // Formato HH:MM — e.g. "09:00"
  @Column({ type: 'varchar', length: 5 })
  startTime: string;

  @Column({ type: 'varchar', length: 5 })
  endTime: string;
}
