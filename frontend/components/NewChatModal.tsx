'use client';

import React, { useState } from 'react';
import { X, Search, Users, MessageCircle, Check } from 'lucide-react';
import { Avatar } from './Avatar';
import { useStore } from '@/lib/store';
import api from '@/lib/api';
import type { User } from '@/lib/types';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface NewChatModalProps {
  onClose: () => void;
}

type ModalMode = 'search' | 'group-create';

export function NewChatModal({ onClose }: NewChatModalProps) {
  const router = useRouter();
  const { addConversation, setActiveConversation, currentUser } = useStore();
  const [mode, setMode] = useState<ModalMode>('search');
  const [searchQ, setSearchQ] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');

  const handleSearch = async (q: string) => {
    setSearchQ(q);
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await api.users.search(q);
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDirect = async (user: User) => {
    try {
      const conv = await api.conversations.create({
        type: 'direct',
        member_ids: [user.id],
      });
      addConversation(conv);
      setActiveConversation(conv.id);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create conversation');
    }
  };

  const toggleSelectUser = (user: User) => {
    setSelectedUsers((prev) =>
      prev.find((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    try {
      const conv = await api.conversations.create({
        type: 'group',
        member_ids: selectedUsers.map((u) => u.id),
        name: groupName.trim(),
        description: groupDesc.trim() || undefined,
      });
      addConversation(conv);
      setActiveConversation(conv.id);
      toast.success(`Group "${groupName}" created!`);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create group');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'search' ? 'New Message' : 'New Group'}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setMode('search')}
            style={{
              flex: 1, padding: '12px', fontSize: 14, fontWeight: 500,
              color: mode === 'search' ? 'var(--signal-blue)' : 'var(--text-secondary)',
              borderBottom: mode === 'search' ? '2px solid var(--signal-blue)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <MessageCircle size={16} /> Direct Message
          </button>
          <button
            onClick={() => setMode('group-create')}
            style={{
              flex: 1, padding: '12px', fontSize: 14, fontWeight: 500,
              color: mode === 'group-create' ? 'var(--signal-blue)' : 'var(--text-secondary)',
              borderBottom: mode === 'group-create' ? '2px solid var(--signal-blue)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Users size={16} /> New Group
          </button>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          {/* Search */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input
                className="search-input"
                placeholder={mode === 'search' ? 'Search by name, username, or phone' : 'Add people'}
                value={searchQ}
                onChange={(e) => handleSearch(e.target.value)}
                autoFocus
              />
              {loading && <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
            </div>
          </div>

          {/* Group name input */}
          {mode === 'group-create' && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <input
                className="form-input"
                placeholder="Group name *"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <input
                className="form-input"
                placeholder="Group description (optional)"
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
              />
            </div>
          )}

          {/* Selected members for group */}
          {mode === 'group-create' && selectedUsers.length > 0 && (
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <div className="member-tag-list">
                {selectedUsers.map((u) => (
                  <div key={u.id} className="member-tag">
                    <Avatar user={u} size="sm" />
                    <span>{u.display_name.split(' ')[0]}</span>
                    <button onClick={() => toggleSelectUser(u)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          <div style={{ overflow: 'auto', maxHeight: 320, padding: '8px 0' }}>
            {results.length === 0 && searchQ.length >= 2 && !loading && (
              <div className="empty-state" style={{ padding: '20px' }}>
                <p>No users found for "{searchQ}"</p>
              </div>
            )}
            {results.map((user) => {
              const isSelected = selectedUsers.find((u) => u.id === user.id);
              return (
                <div
                  key={user.id}
                  className="user-item"
                  style={{ padding: '10px 16px', cursor: 'pointer' }}
                  onClick={() => mode === 'search' ? handleStartDirect(user) : toggleSelectUser(user)}
                >
                  <Avatar user={user} size="md" showOnline={user.is_online} isOnline={user.is_online} />
                  <div className="user-item-info">
                    <div className="user-item-name">{user.display_name}</div>
                    <div className="user-item-phone">
                      {user.username ? `@${user.username} · ` : ''}{user.phone}
                    </div>
                  </div>
                  {mode === 'group-create' && isSelected && (
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--signal-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      <Check size={14} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {mode === 'group-create' && (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedUsers.length === 0}
            >
              Create Group ({selectedUsers.length} members)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
