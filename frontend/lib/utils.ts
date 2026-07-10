import { format, isToday, isYesterday, isSameWeek } from 'date-fns';
import type { Conversation } from './types';

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  if (isSameWeek(date, new Date())) return format(date, 'EEEE');
  return format(date, 'M/d/yy');
}

export function formatMessageTime(dateStr: string): string {
  return format(new Date(dateStr), 'h:mm a');
}

export function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

export function getConversationName(conv: Conversation, currentUserId: string): string {
  if (conv.type === 'group') return conv.name || 'Group';
  const other = conv.members.find((m) => m.user_id !== currentUserId);
  return other?.user?.display_name || 'Unknown';
}

export function getConversationAvatar(conv: Conversation, currentUserId: string): string | null {
  if (conv.avatar_url) return conv.avatar_url;
  if (conv.type === 'direct') {
    const other = conv.members.find((m) => m.user_id !== currentUserId);
    return other?.user?.avatar_url || null;
  }
  return null;
}

export function getOtherUser(conv: Conversation, currentUserId: string) {
  if (conv.type !== 'direct') return null;
  return conv.members.find((m) => m.user_id !== currentUserId)?.user || null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function groupMessagesByDate(messages: import('./types').Message[]) {
  const groups: { date: string; messages: import('./types').Message[] }[] = [];
  for (const msg of messages) {
    const dateLabel = formatFullDate(msg.created_at);
    const last = groups[groups.length - 1];
    if (last && last.date === dateLabel) {
      last.messages.push(msg);
    } else {
      groups.push({ date: dateLabel, messages: [msg] });
    }
  }
  return groups;
}
