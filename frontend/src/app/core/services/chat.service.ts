import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { Conversation, Message, UnreadCounts } from '../models/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private socket: Socket | null = null;

  readonly typingUsers = signal<Record<number, boolean>>({});
  readonly unreadTotal = signal<number>(0);
  readonly unreadByConv = signal<Record<number, number>>({});

  private get apiUrl() {
    return `${environment.apiUrl}/chat`;
  }

  private get wsUrl() {
    if (environment.production) {
      return window.location.origin;
    }
    return environment.apiUrl.replace(/\/api$/, '');
  }

  connect(): Socket {
    if (this.socket?.connected) return this.socket;

    const token = this.auth.token();
    this.socket = io(`${this.wsUrl}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect_error', (err) => {
      console.error('[ChatService] connect error', err.message);
    });

    // Sync unread counts whenever backend sends them
    this.socket.on('unread_counts', (data: UnreadCounts) => {
      this.unreadTotal.set(data.total);
      const map: Record<number, number> = {};
      for (const r of data.byConversation) map[r.conversationId] = r.count;
      this.unreadByConv.set(map);
    });

    return this.socket;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.unreadTotal.set(0);
    this.unreadByConv.set({});
  }

  onNewMessage(cb: (msg: Message) => void): () => void {
    const s = this.connect();
    s.on('new_message', cb);
    return () => s.off('new_message', cb);
  }

  onNotification(cb: (data: { conversationId: number; message: Message }) => void): () => void {
    const s = this.connect();
    s.on('notification', cb);
    return () => s.off('notification', cb);
  }

  onTyping(cb: (data: { userId: number; isTyping: boolean }) => void): () => void {
    const s = this.connect();
    s.on('typing', cb);
    return () => s.off('typing', cb);
  }

  onMessagesRead(cb: (data: { conversationId: number; byUserId: number }) => void): () => void {
    const s = this.connect();
    s.on('messages_read', cb);
    return () => s.off('messages_read', cb);
  }

  joinConversation(conversationId: number): void {
    this.connect().emit('join_conversation', { conversationId });
  }

  sendMessage(conversationId: number, content: string): void {
    this.connect().emit('send_message', { conversationId, content });
  }

  emitTyping(conversationId: number, isTyping: boolean): void {
    this.connect().emit('typing', { conversationId, isTyping });
  }

  emitMarkRead(conversationId: number): void {
    this.connect().emit('mark_read', { conversationId });
  }

  requestUnreadCounts(): void {
    this.connect().emit('get_unread_counts');
  }

  // REST calls
  listConversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.apiUrl}/conversations`);
  }

  openConversation(targetUserId: number): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.apiUrl}/conversations`, { targetUserId });
  }

  getMessages(conversationId: number): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.apiUrl}/conversations/${conversationId}/messages`);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
