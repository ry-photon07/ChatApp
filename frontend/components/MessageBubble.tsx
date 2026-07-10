'use client';

import React, { useState, useRef } from 'react';
import { Reply, Trash2, MoreHorizontal, Download, FileText, Lock } from 'lucide-react';
import { Avatar } from './Avatar';
import { DeliveryStatus } from './DeliveryStatus';
import { useStore } from '@/lib/store';
import api from '@/lib/api';
import type { Message } from '@/lib/types';
import { formatMessageTime, formatFileSize } from '@/lib/utils';
import toast from 'react-hot-toast';

const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];

interface MessageBubbleProps {
  message: Message;
  isOutgoing: boolean;
  isGroupChat: boolean;
  isLastInGroup: boolean;
  showSenderName: boolean;
  currentUserId: string;
  conversationId: string;
}

export function MessageBubble({
  message: msg,
  isOutgoing,
  isGroupChat,
  isLastInGroup,
  showSenderName,
  currentUserId,
  conversationId,
}: MessageBubbleProps) {
  const { setReplyingTo, deleteMessage } = useStore();
  const [showContext, setShowContext] = useState(false);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const contextRef = useRef<HTMLDivElement>(null);

  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextPos({ x: e.clientX, y: e.clientY });
    setShowContext(true);
  };

  const handleReply = () => {
    setReplyingTo(msg);
    setShowContext(false);
  };

  const handleDelete = async () => {
    if (!isOutgoing) return;
    try {
      await api.messages.delete(msg.id);
      deleteMessage(conversationId, msg.id);
      toast.success('Message deleted');
    } catch {
      toast.error('Failed to delete message');
    }
    setShowContext(false);
  };

  const handleReaction = async (emoji: string) => {
    try {
      await api.messages.addReaction(msg.id, emoji);
    } catch {
      toast.error('Failed to add reaction');
    }
  };

  // Close context on outside click
  React.useEffect(() => {
    if (!showContext) return;
    const handler = () => setShowContext(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showContext]);

  if (msg.type === 'system') {
    return (
      <div className="message-wrapper system">
        <div className="message-bubble system">{msg.content}</div>
      </div>
    );
  }

  // Group reactions by emoji
  const reactionGroups: { emoji: string; count: number; users: string[]; isMine: boolean }[] = [];
  for (const r of msg.reactions) {
    const group = reactionGroups.find((g) => g.emoji === r.emoji);
    if (group) {
      group.count++;
      group.users.push(r.user?.display_name || '');
      if (r.user_id === currentUserId) group.isMine = true;
    } else {
      reactionGroups.push({
        emoji: r.emoji,
        count: 1,
        users: [r.user?.display_name || ''],
        isMine: r.user_id === currentUserId,
      });
    }
  }

  const hasAttachments = msg.attachments.length > 0;
  const isImage = msg.attachments.some((a) => a.mime_type.startsWith('image/'));

  return (
    <>
      <div
        className={`message-wrapper ${isOutgoing ? 'outgoing' : 'incoming'} ${isLastInGroup ? 'message-group-end' : ''}`}
        onContextMenu={handleContextMenu}
      >
        {/* Inline reaction row on hover */}
        <div className="emoji-row">
          {QUICK_REACTIONS.map((e) => (
            <button key={e} onClick={() => handleReaction(e)} title={e}>{e}</button>
          ))}
          <button onClick={() => setShowContext(true)} title="More">
            <MoreHorizontal size={16} />
          </button>
        </div>

        {/* Group: show avatar for incoming */}
        {isGroupChat && !isOutgoing && isLastInGroup && (
          <div style={{ position: 'absolute', bottom: 0, left: -42 }}>
            <Avatar user={msg.sender} size="sm" />
          </div>
        )}

        {/* Sender name in group */}
        {showSenderName && (
          <span
            className="message-sender-name"
            style={{ color: getSenderColor(msg.sender_id) }}
          >
            {msg.sender?.display_name}
          </span>
        )}

        <div
          className={`message-bubble ${isOutgoing ? 'outgoing' : 'incoming'} ${msg.is_deleted ? 'deleted' : ''}`}
          style={{
            marginLeft: isGroupChat && !isOutgoing ? 8 : 0,
          }}
        >
          {/* Reply preview */}
          {msg.reply_preview && (
            <div className="reply-preview">
              <div className="reply-preview-name">{msg.reply_preview.sender_display_name}</div>
              <div className="reply-preview-text">{msg.reply_preview.content || '[attachment]'}</div>
            </div>
          )}

          {/* Attachments */}
          {hasAttachments && !msg.is_deleted && (
            <div className="attachment-preview">
              {msg.attachments.map((att) => {
                const url = att.url.startsWith('http') ? att.url : `${BASE_URL}${att.url}`;
                if (att.mime_type.startsWith('image/')) {
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={att.id}
                      src={url}
                      alt={att.file_name}
                      style={{ maxWidth: 280, borderRadius: 8, display: 'block' }}
                      onClick={() => window.open(url, '_blank')}
                    />
                  );
                }
                return (
                  <div key={att.id} className="attachment-file">
                    <FileText size={28} style={{ color: 'var(--signal-blue)', flexShrink: 0 }} />
                    <div className="attachment-file-info">
                      <div className="attachment-file-name">{att.file_name}</div>
                      <div className="attachment-file-size">{formatFileSize(att.file_size)}</div>
                    </div>
                    <a href={url} download={att.file_name} target="_blank" rel="noopener noreferrer">
                      <Download size={18} style={{ color: 'var(--text-tertiary)' }} />
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          {/* Message text */}
          {msg.content && !(hasAttachments && (msg.content === '📷 Image' || msg.content.startsWith('📎 '))) && (
            <div className="message-text">
              {msg.is_deleted ? '🚫 This message was deleted' : msg.content}
            </div>
          )}

          {/* Meta: time + delivery */}
          <div className="message-meta" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {!msg.is_deleted && (
              <span title="End-to-End Encrypted (AES-256)" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Lock size={10} style={{ color: 'var(--message-time-color)', opacity: 0.7 }} />
              </span>
            )}
            {msg.edited_at && !msg.is_deleted && (
              <span style={{ fontSize: 10, color: 'var(--message-time-color)' }}>edited</span>
            )}
            <span className="message-time">{formatMessageTime(msg.created_at)}</span>
            {isOutgoing && <DeliveryStatus message={msg} currentUserId={currentUserId} size={14} />}
          </div>
        </div>

        {/* Reactions */}
        {reactionGroups.length > 0 && (
          <div className="reactions-row">
            {reactionGroups.map((rg) => (
              <button
                key={rg.emoji}
                className={`reaction-bubble ${rg.isMine ? 'own' : ''}`}
                onClick={() => handleReaction(rg.emoji)}
                title={rg.users.join(', ')}
              >
                <span>{rg.emoji}</span>
                {rg.count > 1 && <span className="reaction-count">{rg.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {showContext && (
        <div
          className="message-context-menu"
          ref={contextRef}
          style={{
            position: 'fixed',
            top: Math.min(contextPos.y, window.innerHeight - 200),
            left: Math.min(contextPos.x, window.innerWidth - 200),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 8 }}>
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                style={{ fontSize: 20, width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => { handleReaction(e); setShowContext(false); }}
              >{e}</button>
            ))}
          </div>
          <button className="context-menu-item" onClick={handleReply}>
            <Reply size={16} /> Reply
          </button>
          {isOutgoing && !msg.is_deleted && (
            <button className="context-menu-item danger" onClick={handleDelete}>
              <Trash2 size={16} /> Delete for everyone
            </button>
          )}
        </div>
      )}
    </>
  );
}

// Deterministic color for sender names in group chats
const SENDER_COLORS = [
  '#E57373', '#F06292', '#BA68C8', '#9575CD',
  '#7986CB', '#4DD0E1', '#4DB6AC', '#81C784',
];
function getSenderColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}
