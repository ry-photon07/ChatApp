'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Phone, Video, MoreVertical, ChevronLeft,
  Info, Archive, VolumeX, Volume2, Trash2, UserPlus, Timer
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useWebSocket } from '@/lib/websocket';
import api from '@/lib/api';
import { Avatar, GroupAvatar } from './Avatar';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { GroupInfoDrawer } from './GroupInfoDrawer';
import { formatMessageTime, groupMessagesByDate, getConversationName, getOtherUser } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Conversation, Message } from '@/lib/types';

interface ChatPaneProps {
  conversationId: string;
}

export function ChatPane({ conversationId }: ChatPaneProps) {
  const router = useRouter();
  const {
    conversations, messages: allMessages, currentUser,
    setMessages, addMessage, presence, typing, updateConversation
  } = useStore();
  const { sendTyping, sendRead } = useWebSocket();

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const conv = conversations.find((c) => c.id === conversationId);
  const messages = allMessages[conversationId] || [];
  const typingUsers = (typing[conversationId] || [])
    .filter((id) => id !== currentUser?.id)
    .map((id) => conv?.members.find((m) => m.user_id === id)?.user?.display_name?.split(' ')[0])
    .filter(Boolean);

  const otherUser = conv ? getOtherUser(conv, currentUser?.id || '') : null;
  const isOnline = otherUser
    ? (presence[otherUser.id]?.is_online ?? otherUser.is_online)
    : false;

  useEffect(() => {
    if (!conversationId) return;
    const myMember = conv?.members.find((m) => m.user_id === currentUser?.id);
    setIsMuted(myMember?.is_muted || false);
  }, [conv, currentUser]);

  useEffect(() => {
    setLoading(true);
    setHasMore(true);

    api.conversations.messages(conversationId, undefined, 50)
      .then((msgs) => {
        setMessages(conversationId, msgs);
        setHasMore(msgs.length === 50);
        sendRead(conversationId);
        // Clear unread
        if (conv) updateConversation({ ...conv, unread_count: 0 });
        setTimeout(scrollToBottom, 100);
      })
      .catch(() => toast.error('Failed to load messages'))
      .finally(() => setLoading(false));
  }, [conversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Auto-scroll only if near bottom
    const area = messagesAreaRef.current;
    if (!area) return;
    const isNearBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 200;
    if (isNearBottom) scrollToBottom();
  }, [messages.length]);

  const loadMore = async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const older = await api.conversations.messages(conversationId, oldest.id, 50);
      if (older.length > 0) {
        useStore.getState().prependMessages(conversationId, older);
        setHasMore(older.length === 50);
      } else {
        setHasMore(false);
      }
    } catch {
      toast.error('Failed to load more messages');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleScroll = () => {
    const area = messagesAreaRef.current;
    if (area && area.scrollTop < 100 && !loadingMore && hasMore) {
      loadMore();
    }
  };

  const handleSendMessage = async (content: string, replyToId?: string) => {
    try {
      const msg = await api.conversations.sendMessage(conversationId, {
        content,
        type: 'text',
        reply_to_id: replyToId,
      });
      // Message will come via WS too, but add optimistically
      addMessage(conversationId, msg);
      scrollToBottom();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  const handleToggleMute = async () => {
    try {
      const res = await api.conversations.toggleMute(conversationId);
      setIsMuted(res.is_muted);
      toast.success(res.is_muted ? 'Conversation muted' : 'Conversation unmuted');
    } catch {
      toast.error('Failed to toggle mute');
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!conv) {
    return (
      <div className="chat-pane">
        <div className="chat-pane-empty">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  const convName = getConversationName(conv, currentUser?.id || '');
  const groupedMessages = groupMessagesByDate(messages);

  const headerSubtitle = () => {
    if (conv.type === 'group') {
      return `${conv.members.length} members`;
    }
    if (isOnline) return 'Online';
    if (otherUser?.last_seen) {
      const lastSeen = new Date(presence[otherUser.id]?.last_seen || otherUser.last_seen);
      return `Last seen ${formatMessageTime(lastSeen.toISOString())}`;
    }
    return '';
  };

  return (
    <div className="chat-pane" style={{ flexDirection: 'row' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div className="chat-header" onClick={() => conv.type === 'group' && setShowInfo(true)}>
          <button
            className="icon-btn"
            style={{ display: 'none' }}
            onClick={(e) => { e.stopPropagation(); router.back(); }}
          >
            <ChevronLeft size={22} />
          </button>

          {conv.type === 'group' ? (
            <GroupAvatar
              users={conv.members.filter((m) => m.user_id !== currentUser?.id).map((m) => m.user)}
              size="md"
            />
          ) : (
            <Avatar user={otherUser} size="md" showOnline={isOnline} isOnline={isOnline} />
          )}

          <div className="chat-header-info">
            <div className="chat-header-name">{convName}</div>
            <div className={`chat-header-status ${isOnline && conv.type === 'direct' ? 'online' : ''}`}>
              {typingUsers.length > 0
                ? `${typingUsers.join(', ')} ${typingUsers.length === 1 ? 'is' : 'are'} typing...`
                : headerSubtitle()}
            </div>
          </div>

          <div className="chat-header-actions" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn" title="Voice call" onClick={() => toast('📞 Voice calls coming soon!')}>
              <Phone size={20} />
            </button>
            <button className="icon-btn" title="Video call" onClick={() => toast('📹 Video calls coming soon!')}>
              <Video size={20} />
            </button>
            <button className="icon-btn" title="Search messages" onClick={() => toast('🔍 Message search coming soon!')}>
              <Search size={20} />
            </button>
            {conv.type === 'group' && (
              <button className="icon-btn" title="Group info" onClick={() => setShowInfo(true)}>
                <Info size={20} />
              </button>
            )}
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <button className="icon-btn" title="More" onClick={() => setShowDropdown(!showDropdown)}>
                <MoreVertical size={20} />
              </button>
              {showDropdown && (
                <div className="dropdown">
                  {conv.type === 'group' && (
                    <button className="dropdown-item" onClick={() => { setShowInfo(true); setShowDropdown(false); }}>
                      <Info size={16} /> Group info
                    </button>
                  )}
                  <button className="dropdown-item" onClick={() => { handleToggleMute(); setShowDropdown(false); }}>
                    {isMuted ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    {isMuted ? 'Unmute' : 'Mute'} notifications
                  </button>
                  {conv.disappearing_timer ? (
                    <button className="dropdown-item" onClick={() => toast('Disappearing messages: ' + conv.disappearing_timer + 's')}>
                      <Timer size={16} /> Disappearing messages
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Disappearing timer banner */}
        {conv.disappearing_timer && (
          <div className="disappearing-indicator">
            <Timer size={14} />
            Disappearing messages: {conv.disappearing_timer >= 86400
              ? `${Math.floor(conv.disappearing_timer / 86400)}d`
              : conv.disappearing_timer >= 3600
              ? `${Math.floor(conv.disappearing_timer / 3600)}h`
              : `${Math.floor(conv.disappearing_timer / 60)}m`}
          </div>
        )}

        {/* Messages */}
        <div className="messages-area" ref={messagesAreaRef} onScroll={handleScroll}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="spinner" />
            </div>
          ) : (
            <div className="messages-inner">
              <div style={{ marginTop: 'auto' }} />
              {hasMore && (
                <div className="messages-load-more">
                  <button onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? 'Loading...' : 'Load older messages'}
                  </button>
                </div>
              )}

              {groupedMessages.map(({ date, messages: msgs }) => (
                <React.Fragment key={date}>
                  <div className="date-separator">
                    <span className="date-separator-label">{date}</span>
                  </div>
                  {msgs.map((msg, i) => {
                    const isLast = i === msgs.length - 1 ||
                      msgs[i + 1]?.sender_id !== msg.sender_id;
                    return (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        isOutgoing={msg.sender_id === currentUser?.id}
                        isGroupChat={conv.type === 'group'}
                        isLastInGroup={isLast}
                        showSenderName={conv.type === 'group' && msg.sender_id !== currentUser?.id && (i === 0 || msgs[i - 1]?.sender_id !== msg.sender_id)}
                        currentUserId={currentUser?.id || ''}
                        conversationId={conversationId}
                      />
                    );
                  })}
                </React.Fragment>
              ))}

              {typingUsers.length > 0 && (
                <div className="typing-indicator">
                  <div
                    style={{
                      background: 'var(--message-in-bg)',
                      borderRadius: '18px 18px 18px 2px',
                      padding: '10px 14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div className="typing-dots">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <MessageComposer
          conversationId={conversationId}
          onSend={handleSendMessage}
          onTyping={(isTyping) => sendTyping(conversationId, isTyping)}
        />
      </div>

      {/* Group Info Drawer */}
      {showInfo && conv.type === 'group' && (
        <GroupInfoDrawer
          conversation={conv}
          currentUserId={currentUser?.id || ''}
          onClose={() => setShowInfo(false)}
        />
      )}
    </div>
  );
}
