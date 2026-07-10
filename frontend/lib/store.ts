// ============================================================
// Zustand Global Store
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Conversation, Message, PresenceState } from './types';

interface TypingMap {
  [convId: string]: string[];
}

interface Store {
  // Auth
  token: string | null;
  currentUser: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  updateCurrentUser: (user: User) => void;

  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Conversations
  conversations: Conversation[];
  setConversations: (convs: Conversation[]) => void;
  updateConversation: (conv: Conversation) => void;
  addConversation: (conv: Conversation) => void;
  activeConversationId: string | null;
  setActiveConversation: (id: string | null) => void;

  // Messages per conversation
  messages: { [convId: string]: Message[] };
  setMessages: (convId: string, msgs: Message[]) => void;
  prependMessages: (convId: string, msgs: Message[]) => void;
  addMessage: (convId: string, msg: Message) => void;
  updateMessageStatus: (convId: string, msgId: string, userId: string, status: string) => void;
  markAllMessagesRead: (convId: string, userId: string) => void;
  deleteMessage: (convId: string, msgId: string) => void;
  updateReaction: (data: Record<string, unknown>) => void;

  // Typing
  typing: TypingMap;
  setTyping: (convId: string, userId: string, isTyping: boolean) => void;

  // Presence
  presence: PresenceState;
  setPresence: (userId: string, state: { is_online: boolean; last_seen: string }) => void;

  // Reply
  replyingTo: Message | null;
  setReplyingTo: (msg: Message | null) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // Auth
      token: null,
      currentUser: null,
      setAuth: (token, user) => {
        if (typeof window !== 'undefined') localStorage.setItem('signal_token', token);
        set({ token, currentUser: user });
      },
      clearAuth: () => {
        if (typeof window !== 'undefined') localStorage.removeItem('signal_token');
        set({ token: null, currentUser: null, conversations: [], messages: {} });
      },
      updateCurrentUser: (user) => set({ currentUser: user }),

      // Theme
      theme: 'light',
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),

      // Conversations
      conversations: [],
      setConversations: (convs) => set({ conversations: convs }),
      updateConversation: (conv) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.id === conv.id ? conv : c)),
        })),
      addConversation: (conv) =>
        set((s) => {
          const exists = s.conversations.find((c) => c.id === conv.id);
          if (exists) return s;
          return { conversations: [conv, ...s.conversations] };
        }),
      activeConversationId: null,
      setActiveConversation: (id) => set({ activeConversationId: id }),

      // Messages
      messages: {},
      setMessages: (convId, msgs) =>
        set((s) => ({ messages: { ...s.messages, [convId]: msgs } })),
      prependMessages: (convId, msgs) =>
        set((s) => ({
          messages: {
            ...s.messages,
            [convId]: [...msgs, ...(s.messages[convId] || [])],
          },
        })),
      addMessage: (convId, msg) =>
        set((s) => {
          const existing = s.messages[convId] || [];
          const idx = existing.findIndex((m) => m.id === msg.id);
          const updated = idx >= 0
            ? existing.map((m, i) => i === idx ? msg : m)
            : [...existing, msg];
          // Update conversation's last message
          const conversations = s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  last_message: msg,
                  last_message_at: msg.created_at,
                  unread_count:
                    c.id !== s.activeConversationId && msg.sender_id !== s.currentUser?.id
                      ? c.unread_count + 1
                      : c.unread_count,
                }
              : c
          );
          // Sort conversations by last_message_at
          conversations.sort(
            (a, b) =>
              new Date(b.last_message_at || 0).getTime() -
              new Date(a.last_message_at || 0).getTime()
          );
          return {
            messages: { ...s.messages, [convId]: updated },
            conversations,
          };
        }),
      updateMessageStatus: (convId, msgId, userId, status) =>
        set((s) => {
          const msgs = s.messages[convId];
          if (!msgs) return s;
          return {
            messages: {
              ...s.messages,
              [convId]: msgs.map((m) =>
                m.id === msgId
                  ? {
                      ...m,
                      statuses: m.statuses.map((st) =>
                        st.user_id === userId
                          ? { ...st, status: status as 'sent' | 'delivered' | 'read' }
                          : st
                      ),
                    }
                  : m
              ),
            },
          };
        }),
      markAllMessagesRead: (convId, userId) =>
        set((s) => {
          const msgs = s.messages[convId];
          if (!msgs) return s;
          return {
            messages: {
              ...s.messages,
              [convId]: msgs.map((m) => ({
                ...m,
                statuses: m.statuses.map((st) =>
                  st.user_id === userId ? { ...st, status: 'read' as const } : st
                ),
              })),
            },
          };
        }),
      deleteMessage: (convId, msgId) =>
        set((s) => {
          const msgs = s.messages[convId];
          if (!msgs) return s;
          return {
            messages: {
              ...s.messages,
              [convId]: msgs.map((m) =>
                m.id === msgId
                  ? { ...m, is_deleted: true, content: 'This message was deleted' }
                  : m
              ),
            },
          };
        }),
      updateReaction: (data) =>
        set((s) => {
          const { message_id, conversation_id } = data as {
            message_id: string;
            conversation_id: string;
          };
          const msgs = s.messages[conversation_id as string];
          if (!msgs) return s;
          return {
            messages: {
              ...s.messages,
              [conversation_id]: msgs.map((m) => {
                if (m.id !== message_id) return m;
                const reaction = data as unknown as import('./types').MessageReaction & {
                  message_id: string;
                  conversation_id: string;
                };
                const existingIdx = m.reactions.findIndex(
                  (r) => r.user_id === reaction.user_id && r.emoji === reaction.emoji
                );
                if (existingIdx >= 0) {
                  // Toggle off
                  return {
                    ...m,
                    reactions: m.reactions.filter((_, i) => i !== existingIdx),
                  };
                }
                return {
                  ...m,
                  reactions: [...m.reactions, reaction as import('./types').MessageReaction],
                };
              }),
            },
          };
        }),

      // Typing
      typing: {},
      setTyping: (convId, userId, isTyping) =>
        set((s) => {
          const current = s.typing[convId] || [];
          const updated = isTyping
            ? current.includes(userId)
              ? current
              : [...current, userId]
            : current.filter((id) => id !== userId);
          return { typing: { ...s.typing, [convId]: updated } };
        }),

      // Presence
      presence: {},
      setPresence: (userId, state) =>
        set((s) => ({ presence: { ...s.presence, [userId]: state } })),

      // Reply
      replyingTo: null,
      setReplyingTo: (msg) => set({ replyingTo: msg }),

      // Search
      searchQuery: '',
      setSearchQuery: (q) => set({ searchQuery: q }),
    }),
    {
      name: 'signal-store',
      partialize: (s) => ({
        token: s.token,
        currentUser: s.currentUser,
        theme: s.theme,
      }),
    }
  )
);
