import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ElementRef,
  ViewChild,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { Conversation, Message } from '../../core/models/chat.model';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesEnd') private messagesEnd!: ElementRef<HTMLDivElement>;

  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  readonly conversations = signal<Conversation[]>([]);
  readonly activeConversation = signal<Conversation | null>(null);
  readonly messages = signal<Message[]>([]);
  readonly loadingMessages = signal(false);
  readonly loadingConversations = signal(false);
  readonly typingMap = signal<Record<number, boolean>>({});
  readonly error = signal<string | null>(null);
  readonly toast = signal<string | null>(null);

  newMessage = '';
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;
  private cleanupFns: Array<() => void> = [];
  private shouldScrollToBottom = false;

  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? 0);

  readonly peerName = computed(() => {
    const conv = this.activeConversation();
    if (!conv) return '';
    const me = this.currentUserId();
    return conv.participantAId === me
      ? (conv.participantB?.name ?? 'Usuario')
      : (conv.participantA?.name ?? 'Usuario');
  });

  readonly isTyping = computed(() => {
    const conv = this.activeConversation();
    if (!conv) return false;
    const map = this.typingMap();
    return Object.entries(map).some(
      ([uid, typing]) => Number(uid) !== this.currentUserId() && typing,
    );
  });

  ngOnInit(): void {
    this.loadConversations();
    this.setupSocketListeners();

    const queryConvId = this.route.snapshot.queryParamMap.get('conversationId');
    if (queryConvId) {
      this.chatService.listConversations().subscribe((convs) => {
        const target = convs.find((c) => c.id === Number(queryConvId));
        if (target) this.selectConversation(target);
      });
    }
  }

  ngOnDestroy(): void {
    this.cleanupFns.forEach((fn) => fn());
    this.chatService.disconnect();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  loadConversations(): void {
    this.loadingConversations.set(true);
    this.chatService.listConversations().subscribe({
      next: (convs) => {
        this.conversations.set(convs);
        this.loadingConversations.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las conversaciones');
        this.loadingConversations.set(false);
      },
    });
  }

  selectConversation(conv: Conversation): void {
    this.activeConversation.set(conv);
    this.messages.set([]);
    this.loadingMessages.set(true);
    this.chatService.joinConversation(conv.id);

    this.chatService.getMessages(conv.id).subscribe({
      next: (msgs) => {
        this.messages.set(msgs);
        this.loadingMessages.set(false);
        this.shouldScrollToBottom = true;
        this.chatService.emitMarkRead(conv.id);
      },
      error: () => {
        this.error.set('No se pudieron cargar los mensajes');
        this.loadingMessages.set(false);
      },
    });
  }

  send(): void {
    const content = this.newMessage.trim();
    const conv = this.activeConversation();
    if (!content || !conv) return;

    this.newMessage = '';
    this.chatService.sendMessage(conv.id, content);
    this.chatService.emitTyping(conv.id, false);
  }

  onInput(): void {
    const conv = this.activeConversation();
    if (!conv) return;

    this.chatService.emitTyping(conv.id, true);

    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.chatService.emitTyping(conv.id, false);
    }, 2000);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  isMine(msg: Message): boolean {
    return msg.senderId === this.currentUserId();
  }

  conversationLabel(conv: Conversation): string {
    const me = this.currentUserId();
    return conv.participantAId === me
      ? (conv.participantB?.name ?? 'Usuario')
      : (conv.participantA?.name ?? 'Usuario');
  }

  unreadCount(conv: Conversation): number {
    return this.chatService.unreadByConv()[conv.id] ?? 0;
  }

  private showToast(text: string): void {
    this.toast.set(text);
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.toast.set(null), 4000);
  }

  private setupSocketListeners(): void {
    this.cleanupFns.push(
      this.chatService.onNewMessage((msg) => {
        const conv = this.activeConversation();
        if (conv && msg.conversationId === conv.id) {
          this.messages.update((msgs) => [...msgs, msg]);
          this.shouldScrollToBottom = true;
          this.chatService.emitMarkRead(conv.id);
        }
        this.loadConversations();
      }),
    );

    // Toast when a message arrives for a conversation we're not currently viewing
    this.cleanupFns.push(
      this.chatService.onNotification(({ conversationId, message }) => {
        const active = this.activeConversation();
        if (!active || active.id !== conversationId) {
          const sender = message.sender?.name ?? 'Alguien';
          this.showToast(`Nuevo mensaje de ${sender}`);
          // Refresh list so unread badge on the sidebar updates
          this.loadConversations();
        }
      }),
    );

    this.cleanupFns.push(
      this.chatService.onTyping(({ userId, isTyping }) => {
        this.typingMap.update((map) => ({ ...map, [userId]: isTyping }));
      }),
    );
  }

  private scrollToBottom(): void {
    this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
  }
}
