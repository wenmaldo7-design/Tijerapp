export interface ChatUser {
  id: number;
  name: string;
  email: string;
}

export interface Conversation {
  id: number;
  participantAId: number;
  participantBId: number;
  participantA: ChatUser;
  participantB: ChatUser;
  createdAt: string;
}

export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  sender: ChatUser;
  content: string;
  createdAt: string;
  readAt: string | null;
}

export interface UnreadCounts {
  total: number;
  byConversation: Array<{ conversationId: number; count: number }>;
}
