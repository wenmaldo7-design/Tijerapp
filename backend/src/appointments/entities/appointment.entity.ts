import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { StaffProfile } from '../../staff/entities/staff-profile.entity';
import { Service } from '../../services/entities/service.entity';

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clientId: number;

  @ManyToOne(() => User, (user) => user.appointments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: User;

  @Column()
  staffProfileId: number;

  @ManyToOne(() => StaffProfile, (staff) => staff.appointments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffProfileId' })
  staff: StaffProfile;

  @Column()
  serviceId: number;

  @ManyToOne(() => Service, (service) => service.appointments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @Column({ type: 'datetime' })
  startTime: Date;

  // endTime = startTime + service.durationMinutes (calculado al crear el turno)
  @Column({ type: 'datetime' })
  endTime: Date;

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.PENDING,
  })
  status: AppointmentStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: false })
  reminderSent: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
