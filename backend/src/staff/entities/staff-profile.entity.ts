import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { WorkingHours } from './working-hours.entity';
import { TimeOff } from './time-off.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';

@Entity('staff_profiles')
export class StaffProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  userId: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'simple-array', nullable: true })
  specialties: string[];

  @Column({ type: 'text', nullable: true })
  bio: string;

  @OneToMany(() => WorkingHours, (wh) => wh.staffProfile, { cascade: true })
  workingHours: WorkingHours[];

  @OneToMany(() => TimeOff, (to) => to.staffProfile, { cascade: true })
  timeOffs: TimeOff[];

  @OneToMany(() => Appointment, (a) => a.staff)
  appointments: Appointment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
