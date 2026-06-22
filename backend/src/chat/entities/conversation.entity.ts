import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Message } from './message.entity';

@Entity('conversations')
@Index('IDX_conversations_participants', ['participantAId', 'participantBId'], { unique: true })
export class Conversation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  participantAId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participantAId' })
  participantA: User;

  @Column()
  participantBId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participantBId' })
  participantB: User;

  @OneToMany(() => Message, (m) => m.conversation)
  messages: Message[];

  @CreateDateColumn()
  createdAt: Date;
}
