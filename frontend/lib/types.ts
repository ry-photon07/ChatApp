// ============================================================
// Signal Messenger Clone — Global Types
// ============================================================

export interface User {
  id: string;
  phone: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_online: boolean;
  last_seen: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  contact_id: string;
  nickname: string | null;
  created_at: string;
  user: User;
}

export interface MessageStatus {
  user_id: string;
  status: 'sent' | 'delivered' | 'read';
  updated_at: string;
}

export interface MessageReaction {
  id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user: User;
}

export interface Attachment {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  url: string;
}

export interface ReplyPreview {
  id: string;
  content: string | null;
  sender_display_name: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: 'text' | 'image' | 'file' | 'system' | 'reaction';
  reply_to_id: string | null;
  reply_preview: ReplyPreview | null;
  is_deleted: boolean;
  disappears_at: string | null;
  created_at: string;
  edited_at: string | null;
  sender: User;
  statuses: MessageStatus[];
  reactions: MessageReaction[];
  attachments: Attachment[];
}

export interface ConversationMember {
  id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  last_read_at: string | null;
  is_muted: boolean;
  is_pinned: boolean;
  user: User;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  avatar_url: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  last_message_at: string | null;
  disappearing_timer: number | null;
  is_archived: boolean;
  members: ConversationMember[];
  last_message: Message | null;
  unread_count: number;
}

export interface TypingState {
  [conversationId: string]: string[]; // user_ids currently typing
}

export interface PresenceState {
  [userId: string]: { is_online: boolean; last_seen: string };
}

export type MessageDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface WSMessage {
  type: string;
  data: Record<string, unknown>;
}
