import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

interface AuthSocket extends Socket {
  user: { id: number; email: string; role: string };
}

@WebSocketGateway({
  cors: {
    origin: (_origin: string, cb: (err: Error | null, allow?: boolean) => void) => {
      cb(null, true);
    },
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync<{ sub: number; email: string; role: string }>(
        token,
        { secret },
      );
      (client as AuthSocket).user = { id: payload.sub, email: payload.email, role: payload.role };

      // Personal room for cross-conversation notifications
      await client.join(`user:${payload.sub}`);

      // Join all conversation rooms
      const conversations = await this.chatService.listConversations((client as AuthSocket).user);
      for (const conv of conversations) {
        await client.join(`conv:${conv.id}`);
      }

      // Send current unread counts so client can show badge immediately
      const unread = await this.chatService.getUnreadCounts((client as AuthSocket).user);
      client.emit('unread_counts', unread);

      this.logger.log(`Socket connected: user=${payload.sub} (${conversations.length} rooms)`);
    } catch {
      client.emit('error', { message: 'Token inválido o ausente' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const user = (client as AuthSocket).user;
    if (user) this.logger.log(`Socket disconnected: user=${user.id}`);
  }

  @SubscribeMessage('join_conversation')
  async handleJoin(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { conversationId: number },
  ): Promise<void> {
    await this.chatService.assertParticipant(data.conversationId, client.user);
    await client.join(`conv:${data.conversationId}`);
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { conversationId: number; content: string },
  ): Promise<void> {
    if (!data.content?.trim()) throw new WsException('El mensaje no puede estar vacío');

    const conv = await this.chatService.assertParticipant(data.conversationId, client.user);
    const message = await this.chatService.createMessage(
      data.conversationId,
      client.user.id,
      data.content.trim(),
      client.user,
    );

    // Emit to conversation room (all participants in the thread)
    this.server.to(`conv:${data.conversationId}`).emit('new_message', message);

    // Also notify the other participant's personal room so they get an alert
    // even if they are on a different page
    const recipientId = this.chatService.getOtherParticipantId(conv, client.user.id);
    this.server.to(`user:${recipientId}`).emit('notification', {
      conversationId: data.conversationId,
      message,
    });
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { conversationId: number; isTyping: boolean },
  ): Promise<void> {
    await this.chatService.assertParticipant(data.conversationId, client.user);
    client.to(`conv:${data.conversationId}`).emit('typing', {
      userId: client.user.id,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { conversationId: number },
  ): Promise<void> {
    await this.chatService.markRead(data.conversationId, client.user.id, client.user);

    client.to(`conv:${data.conversationId}`).emit('messages_read', {
      conversationId: data.conversationId,
      byUserId: client.user.id,
    });

    // Send updated unread counts to the reader
    const unread = await this.chatService.getUnreadCounts(client.user);
    client.emit('unread_counts', unread);
  }

  @SubscribeMessage('get_unread_counts')
  async handleGetUnreadCounts(@ConnectedSocket() client: AuthSocket): Promise<void> {
    const unread = await this.chatService.getUnreadCounts(client.user);
    client.emit('unread_counts', unread);
  }

  private extractToken(client: Socket): string {
    const fromAuth = (client.handshake.auth as Record<string, string>)?.token;
    if (fromAuth) return fromAuth;

    const header = client.handshake.headers?.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);

    throw new WsException('Token no provisto');
  }
}
