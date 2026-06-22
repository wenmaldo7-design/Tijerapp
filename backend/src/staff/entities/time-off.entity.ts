import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { StaffProfile } from './staff-profile.entity';

@Entity('time_offs')
export class TimeOff {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  staffProfileId: number;

  @ManyToOne(() => StaffProfile, (profile) => profile.timeOffs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'staffProfileId' })
  staffProfile: StaffProfile;

  // Fechas en formato YYYY-MM-DD — se almacenan como fecha local (Canarias)
  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @CreateDateColumn()
  createdAt: Date;
}
