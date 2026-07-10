'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Search, Edit, Settings, Moon, Sun, Archive, X,
  MessageSquarePlus, Filter
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { Avatar, GroupAvatar } from './Avatar';
import { NewChatModal } from './NewChatModal';
import { ProfileModal } from './ProfileModal';
import type { Conversation } from '@/lib/types';
import { formatTime, getConversationName, getConversationAvatar } from '@/lib/utils';
import api from '@/lib/api';
import { DeliveryStatus } from './DeliveryStatus';
import { VolumeX, Pin } from 'lucide-react';

interface SidebarProps {
  onOpenSettings: () => void;
}

export function Sidebar({ onOpenSettings }: SidebarProps) {
  const router = useRouter();
  const params = useParams();
  const activeId = params?.id as string | undefined;

  const { conversations, searchQuery, setSearchQuery, currentUser, theme, toggleTheme } = useStore();
  const [showNewChat, setShowNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = getConversationName(c, currentUser?.id || '').toLowerCase();
      const lastMsg = c.last_message?.content?.toLowerCase() || '';
      return name.includes(q) || lastMsg.includes(q);
    });
  }, [conversations, searchQuery, currentUser]);

  const pinned = filtered.filter((c) => {
    const me = c.members.find((m) => m.user_id === currentUser?.id);
    return me?.is_pinned;
  });

  const unpinned = filtered.filter((c) => {
    const me = c.members.find((m) => m.user_id === currentUser?.id);
    return !me?.is_pinned;
  });

  const handleSelect = (conv: Conversation) => {
    useStore.getState().setActiveConversation(conv.id);
    // Mark as read
    api.conversations.markRead(conv.id).catch(() => {});
    // Clear unread
    useStore.getState().updateConversation({ ...conv, unread_count: 0 });
  };

  return (
    <>
      <aside className="sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <button className="icon-btn" onClick={() => setShowProfile(true)} title="Profile" style={{ padding: 0 }}>
            <Avatar user={currentUser} size="sm" showOnline />
          </button>
          <span className="sidebar-header-title">Signal</span>
          <div className="sidebar-header-actions">
            <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="icon-btn" onClick={() => setShowNewChat(true)} title="New chat">
              <Edit size={20} />
            </button>
            <button className="icon-btn" onClick={onOpenSettings} title="Settings">
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="search-container">
          <div className="search-input-wrapper">
            <Search className="search-icon" size={18} />
            <input
              className="search-input"
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ color: 'var(--text-tertiary)' }}>
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Archive banner */}
        <button className="archive-banner" onClick={() => setShowArchive(!showArchive)}>
          <Archive size={20} />
          Archived
        </button>

        {/* Conversation List */}
        <div className="conversation-list">
          {pinned.length > 0 && (
            <>
              <div className="section-header-label">Pinned</div>
              {pinned.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeId}
                  currentUserId={currentUser?.id || ''}
                  onClick={() => handleSelect(conv)}
                  isPinned
                />
              ))}
              <div className="divider" />
            </>
          )}

          {unpinned.length === 0 && pinned.length === 0 && (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              {searchQuery ? (
                <>
                  <Search size={32} />
                  <h3>No results</h3>
                  <p>No conversations matching "{searchQuery}"</p>
                </>
              ) : (
                <>
                  <MessageSquarePlus size={32} style={{ color: 'var(--signal-blue)' }} />
                  <h3>No conversations yet</h3>
                  <p>Click the pencil icon to start a new conversation</p>
                </>
              )}
            </div>
          )}

          {unpinned.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeId}
              currentUserId={currentUser?.id || ''}
              onClick={() => handleSelect(conv)}
            />
          ))}
        </div>
      </aside>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  currentUserId: string;
  onClick: () => void;
  isPinned?: boolean;
}

function ConversationItem({ conversation: conv, isActive, currentUserId, onClick, isPinned }: ConversationItemProps) {
  const { presence } = useStore();
  const name = getConversationName(conv, currentUserId);
  const myMember = conv.members.find((m) => m.user_id === currentUserId);
  const isMuted = myMember?.is_muted || false;

  const otherUser = conv.type === 'direct'
    ? conv.members.find((m) => m.user_id !== currentUserId)?.user
    : null;

  const isOnline = otherUser
    ? (presence[otherUser.id]?.is_online ?? otherUser.is_online)
    : false;

  const lastMsg = conv.last_message;
  const isMine = lastMsg?.sender_id === currentUserId;
  const unread = conv.unread_count;

  const previewText = useMemo(() => {
    if (!lastMsg) return '';
    if (lastMsg.is_deleted) return '🚫 Message deleted';
    if (lastMsg.type === 'system') return lastMsg.content || '';
    if (lastMsg.type === 'image') return '📷 Photo';
    if (lastMsg.type === 'file') return '📎 File';
    const prefix = conv.type === 'group' && !isMine
      ? `${lastMsg.sender?.display_name?.split(' ')[0]}: `
      : '';
    return prefix + (lastMsg.content || '');
  }, [lastMsg, conv.type, isMine]);

  const avatarEl = conv.type === 'group'
    ? <GroupAvatar users={conv.members.filter((m) => m.user_id !== currentUserId).map((m) => m.user)} size="md" />
    : <Avatar user={otherUser} size="md" showOnline={isOnline} isOnline={isOnline} />;

  return (
    <div
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="conversation-item-avatar">
        {avatarEl}
      </div>
      <div className="conversation-item-content">
        <div className="conversation-item-header">
          <span className="conversation-item-name">{name}</span>
          <span className={`conversation-item-time ${unread > 0 && !isMuted ? 'has-unread' : ''}`}>
            {lastMsg ? formatTime(lastMsg.created_at) : ''}
          </span>
        </div>
        <div className="conversation-item-footer">
          <div className="conversation-item-preview">
            {isMine && lastMsg && !lastMsg.is_deleted && (
              <DeliveryStatus message={lastMsg} currentUserId={currentUserId} size={14} />
            )}
            <span className="conversation-item-preview-text">{previewText}</span>
          </div>
          <div className="conversation-item-badges">
            {isMuted && <VolumeX size={14} className="muted-icon" />}
            {isPinned && <Pin size={14} style={{ color: 'var(--text-tertiary)' }} />}
            {unread > 0 && !isMuted && (
              <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>
            )}
            {unread > 0 && isMuted && (
              <span className="unread-badge" style={{ background: 'var(--text-tertiary)' }}>
                {unread}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
