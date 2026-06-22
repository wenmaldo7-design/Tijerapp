import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/user-role.enum';

export interface AuthUser {
  id: number;
  email: string;
  role: string;
}

export interface UnreadCount {
  conversationId: number;
  count: number;
}

const ALLOWED_PAIRS: Array<[UserRole, UserRole]> = [
  [UserRole.CLIENT, UserRole.STAFF],
  [UserRole.ADMIN, UserRole.STAFF],
];

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly msgRepo: Repository<Message>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async listConversations(user: AuthUser): Promise<Conversation[]> {
    return this.convRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.participantA', 'pa')
      .leftJoinAndSelect('c.participantB', 'pb')
      .where('c.participantAId = :id OR c.participantBId = :id', { id: user.id })
      .orderBy('c.createdAt', 'DESC')
      .getMany();
  }

  async openConversation(requesterId: number, targetUserId: number): Promise<Conversation> {
    if (requesterId === targetUserId) {
      throw new BadRequestException('No podés abrir una conversación contigo mismo');
    }

    const [requester, target] = await Promise.all([
      this.userRepo.findOneBy({ id: requesterId }),
      this.userRepo.findOneBy({ id: targetUserId }),
    ]);
    if (!requester) throw new NotFoundException('Usuario solicitante no encontrado');
    if (!target) throw new NotFoundException(`Usuario #${targetUserId} no encontrado`);

    const requesterRole = requester.role;
    const targetRole = target.role;

    const allowed = ALLOWED_PAIRS.some(
      ([a, b]) =>
        (requesterRole === a && targetRole === b) ||
        (requesterRole === b && targetRole === a),
    );
    if (!allowed) {
      throw new BadRequestException(
        `No se permite una conversación entre ${requesterRole} y ${targetRole}`,
      );
    }

    // Normalize: lower ID always goes to participantA for unique-constraint stability
    const [participantAId, participantBId] =
      requesterId < targetUserId
        ? [requesterId, targetUserId]
        : [targetUserId, requesterId];

    const existing = await this.convRepo.findOne({
      where: { participantAId, participantBId },
      relations: { participantA: true, participantB: true },
    });
    if (existing) return existing;

    const conv = this.convRepo.create({ participantAId, participantBId });
    const saved = await this.convRepo.save(conv);
    return this.convRepo.findOneOrFail({
      where: { id: saved.id },
      relations: { participantA: true, participantB: true },
    });
  }

  async getMessages(conversationId: number, user: AuthUser): Promise<Message[]> {
    await this.assertParticipant(conversationId, user);
    return this.msgRepo.find({
      where: { conversationId },
      relations: { sender: true },
      order: { createdAt: 'ASC' },
    });
  }

  async createMessage(
    conversationId: number,
    senderId: number,
    content: string,
    user: AuthUser,
  ): Promise<Message> {
    await this.assertParticipant(conversationId, user);
    const msg = this.msgRepo.create({ conversationId, senderId, content });
    const saved = await this.msgRepo.save(msg);
    return this.msgRepo.findOneOrFail({
      where: { id: saved.id },
      relations: { sender: true },
    });
  }

  async markRead(conversationId: number, userId: number, user: AuthUser): Promise<void> {
    await this.assertParticipant(conversationId, user);
    await this.msgRepo
      .createQueryBuilder()
      .update()
      .set({ readAt: new Date() })
      .where('conversationId = :cid AND senderId != :uid AND readAt IS NULL', {
        cid: conversationId,
        uid: userId,
      })
      .execute();
  }

  async getUnreadCounts(user: AuthUser): Promise<{ total: number; byConversation: UnreadCount[] }> {
    const rows = await this.msgRepo
      .createQueryBuilder('m')
      .select('m.conversationId', 'conversationId')
      .addSelect('COUNT(m.id)', 'count')
      .innerJoin('m.conversation', 'c')
      .where('(c.participantAId = :uid OR c.participantBId = :uid)', { uid: user.id })
      .andWhere('m.senderId != :uid', { uid: user.id })
      .andWhere('m.readAt IS NULL')
      .groupBy('m.conversationId')
      .getRawMany<{ conversationId: number; count: string }>();

    const byConversation = rows.map((r) => ({
      conversationId: Number(r.conversationId),
      count: Number(r.count),
    }));
    const total = byConversation.reduce((s, r) => s + r.count, 0);
    return { total, byConversation };
  }

  async assertParticipant(conversationId: number, user: AuthUser): Promise<Conversation> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    const isParticipant = conv.participantAId === user.id || conv.participantBId === user.id;
    if (!isParticipant) {
      throw new ForbiddenException('No tenés acceso a esta conversación');
    }
    return conv;
  }

  getOtherParticipantId(conv: Conversation, userId: number): number {
    return conv.participantAId === userId ? conv.participantBId : conv.participantAId;
  }
}
