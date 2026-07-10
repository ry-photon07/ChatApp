'use client';

import React, { useState } from 'react';
import { X, Crown, UserMinus, UserPlus, Edit2, Timer, Shield } from 'lucide-react';
import { Avatar } from './Avatar';
import { useStore } from '@/lib/store';
import api from '@/lib/api';
import type { Conversation } from '@/lib/types';
import toast from 'react-hot-toast';

interface GroupInfoDrawerProps {
  conversation: Conversation;
  currentUserId: string;
  onClose: () => void;
}

export function GroupInfoDrawer({ conversation: conv, currentUserId, onClose }: GroupInfoDrawerProps) {
  const { updateConversation, conversations } = useStore();
  const [editingName, setEditingName] = useState(false);
  const [groupName, setGroupName] = useState(conv.name || '');
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<import('@/lib/types').User[]>([]);

  const myMember = conv.members.find((m) => m.user_id === currentUserId);
  const isAdmin = myMember?.role === 'admin';

  const handleSaveName = async () => {
    if (!groupName.trim()) return;
    try {
      const updated = await api.conversations.update(conv.id, { name: groupName.trim() });
      updateConversation(updated);
      setEditingName(false);
      toast.success('Group name updated');
    } catch {
      toast.error('Failed to update group name');
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from the group?`)) return;
    try {
      await api.conversations.removeMember(conv.id, userId);
      const updated = await api.conversations.get(conv.id);
      updateConversation(updated);
      toast.success(`${name} removed`);
    } catch {
      toast.error('Failed to remove member');
    }
  };

  const handleLeave = async () => {
    if (!confirm('Leave this group?')) return;
    try {
      await api.conversations.removeMember(conv.id, currentUserId);
      toast.success('Left the group');
      onClose();
    } catch {
      toast.error('Failed to leave group');
    }
  };

  const handleSearchUsers = async (q: string) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const results = await api.users.search(q);
      setSearchResults(results.filter((u) => !conv.members.find((m) => m.user_id === u.id)));
    } catch {
      setSearchResults([]);
    }
  };

  const handleAddMember = async (userId: string, name: string) => {
    try {
      await api.conversations.addMember(conv.id, userId);
      const updated = await api.conversations.get(conv.id);
      updateConversation(updated);
      toast.success(`${name} added to group`);
      setShowAddMember(false);
      setSearchQ('');
      setSearchResults([]);
    } catch {
      toast.error('Failed to add member');
    }
  };

  const handleSetDisappearing = async (seconds: number | null) => {
    try {
      const updated = await api.conversations.update(conv.id, {
        disappearing_timer: seconds ?? undefined,
      });
      updateConversation(updated);
      toast.success(seconds ? `Disappearing messages: ${seconds}s` : 'Disappearing messages off');
    } catch {
      toast.error('Failed to update timer');
    }
  };

  return (
    <div className="info-drawer">
      <div className="info-drawer-header">
        <button className="icon-btn" onClick={onClose}>
          <X size={20} />
        </button>
        <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>Group Info</span>
      </div>

      <div className="info-drawer-content">
        {/* Hero */}
        <div className="info-drawer-hero">
          <Avatar name={conv.name || 'Group'} size="xl" />

          {editingName ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', justifyContent: 'center' }}>
              <input
                className="form-input"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                style={{ maxWidth: 200, textAlign: 'center' }}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              />
              <button className="btn btn-primary" onClick={handleSaveName} style={{ padding: '8px 12px' }}>Save</button>
              <button className="btn btn-secondary" onClick={() => setEditingName(false)} style={{ padding: '8px 12px' }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="info-drawer-name">{conv.name}</span>
              {isAdmin && (
                <button className="icon-btn" onClick={() => setEditingName(true)} title="Edit name">
                  <Edit2 size={16} />
                </button>
              )}
            </div>
          )}

          <span className="info-drawer-meta">
            Group · {conv.members.length} members
          </span>

          {conv.description && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
              {conv.description}
            </p>
          )}
        </div>

        {/* Disappearing Messages */}
        {isAdmin && (
          <div className="info-section">
            <div className="info-section-title">Disappearing Messages</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { label: 'Off', value: null },
                { label: '5 min', value: 300 },
                { label: '1 hour', value: 3600 },
                { label: '1 day', value: 86400 },
                { label: '1 week', value: 604800 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  className={`btn ${conv.disappearing_timer === opt.value ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: 13 }}
                  onClick={() => handleSetDisappearing(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Members */}
        <div className="info-section">
          <div className="info-section-title">{conv.members.length} Members</div>

          {isAdmin && (
            <div>
              {showAddMember ? (
                <div style={{ marginBottom: 12 }}>
                  <input
                    className="form-input"
                    placeholder="Search users to add..."
                    value={searchQ}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    autoFocus
                  />
                  {searchResults.map((u) => (
                    <div key={u.id} className="user-item" onClick={() => handleAddMember(u.id, u.display_name)}>
                      <Avatar user={u} size="sm" />
                      <div className="user-item-info">
                        <div className="user-item-name">{u.display_name}</div>
                        <div className="user-item-phone">{u.phone}</div>
                      </div>
                      <UserPlus size={16} style={{ color: 'var(--signal-blue)' }} />
                    </div>
                  ))}
                  <button className="btn btn-ghost" onClick={() => setShowAddMember(false)} style={{ marginTop: 8 }}>Cancel</button>
                </div>
              ) : (
                <button
                  className="btn btn-ghost"
                  style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}
                  onClick={() => setShowAddMember(true)}
                >
                  <UserPlus size={18} /> Add member
                </button>
              )}
            </div>
          )}

          {conv.members.map((member) => {
            const isMe = member.user_id === currentUserId;
            const canRemove = isAdmin && !isMe;

            return (
              <div key={member.id} className="member-item">
                <Avatar user={member.user} size="sm" showOnline={member.user.is_online} isOnline={member.user.is_online} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>
                      {member.user.display_name}{isMe ? ' (You)' : ''}
                    </span>
                    {member.role === 'admin' && (
                      <Crown size={13} style={{ color: '#FFB300' }} />
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {member.user.phone}
                  </div>
                </div>
                {canRemove && (
                  <button
                    className="icon-btn"
                    onClick={() => handleRemoveMember(member.user_id, member.user.display_name)}
                    title="Remove"
                  >
                    <UserMinus size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Leave group */}
        <div className="info-section">
          <button
            className="btn"
            style={{ color: '#e53935', width: '100%', justifyContent: 'flex-start', gap: 12, fontWeight: 500 }}
            onClick={handleLeave}
          >
            <X size={18} /> Leave group
          </button>
        </div>
      </div>
    </div>
  );
}
