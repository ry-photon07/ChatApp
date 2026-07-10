'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Smile, Paperclip, Send, Mic, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const QUICK_EMOJIS = ['😂', '❤️', '👍', '😮', '😢', '😡', '🎉', '🔥', '💯', '👀', '🙏', '🫡'];
const ALL_EMOJIS = [
  '😀','😂','🤣','😊','😍','🥰','😎','🤔','😴','🤯','🥳','😭',
  '❤️','💕','💯','🔥','⭐','✨','🎉','🎊','👍','👎','👏','🙌',
  '🤝','🫡','🙏','💪','✌️','🤞','🫶','🤙','👋','🌟','🌈','☀️',
  '🌙','⚡','🌊','🍕','☕','🍺','🎵','🎮','💻','📱','🚀','🏆',
  '💎','🌺','🌸','🦋','🐶','🐱','🦁','🐯','🦊','🐸','🦄','🐢',
];

interface MessageComposerProps {
  conversationId: string;
  onSend: (content: string, replyToId?: string) => void;
  onTyping: (isTyping: boolean) => void;
}

export function MessageComposer({ conversationId, onSend, onTyping }: MessageComposerProps) {
  const { replyingTo, setReplyingTo } = useStore();
  const [text, setText] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-resize
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
    }
    // Typing indicator
    onTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => onTyping(false), 2000);
  };

  const handleSend = useCallback(() => {
    const content = text.trim();
    if (!content) return;
    onSend(content, replyingTo?.id);
    setText('');
    setReplyingTo(null);
    onTyping(false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, replyingTo, onSend, setReplyingTo, onTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setText((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // First create a message, then attach
      const isImage = file.type.startsWith('image/');
      const msg = await api.conversations.sendMessage(conversationId, {
        content: isImage ? '📷 Image' : `📎 ${file.name}`,
        type: isImage ? 'image' : 'file',
      });
      await api.messages.uploadAttachment(msg.id, file);
      toast.success('File sent!');
    } catch {
      toast.error('Failed to send file');
    }
    e.target.value = '';
  };

  const isEmpty = !text.trim();
  const isReplying = replyingTo != null;

  return (
    <div className="composer">
      {/* Emoji Picker */}
      {showEmojis && (
        <div className="emoji-picker-wrapper" style={{ left: 0 }}>
          <div className="emoji-grid">
            {ALL_EMOJIS.map((e) => (
              <button key={e} onClick={() => handleEmojiClick(e)}>
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Left: emoji + attach */}
      <button
        className="composer-emoji-btn"
        onClick={() => setShowEmojis(!showEmojis)}
        title="Emoji"
      >
        {showEmojis ? <X size={22} /> : <Smile size={22} />}
      </button>

      <button
        className="composer-attach-btn"
        onClick={() => fileInputRef.current?.click()}
        title="Attach file"
      >
        <Paperclip size={22} />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        accept="image/*,application/pdf,.doc,.docx,.txt,.zip"
        onChange={handleFileChange}
      />

      {/* Main input area */}
      <div className="composer-main">
        {isReplying && replyingTo && (
          <div className="reply-bar">
            <div className="reply-bar-content">
              <div className="reply-bar-name">{replyingTo.sender?.display_name}</div>
              <div className="reply-bar-text">
                {replyingTo.content || '[attachment]'}
              </div>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="composer-input-row">
          <textarea
            ref={textareaRef}
            className="composer-textarea"
            placeholder="Message"
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{ height: 24 }}
            onClick={() => setShowEmojis(false)}
          />
        </div>
      </div>

      {/* Send / Mic */}
      {isEmpty ? (
        <button className="composer-send-btn" onClick={() => toast('🎙️ Voice messages coming soon!')} title="Voice message">
          <Mic size={22} />
        </button>
      ) : (
        <button className="composer-send-btn" onClick={handleSend} title="Send (Enter)">
          <Send size={20} />
        </button>
      )}
    </div>
  );
}
