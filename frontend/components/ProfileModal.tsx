'use client';

import React, { useState, useRef } from 'react';
import { X, Camera, Loader2 } from 'lucide-react';
import { Avatar } from './Avatar';
import { useStore } from '@/lib/store';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface ProfileModalProps {
  onClose: () => void;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
  const { currentUser, updateCurrentUser } = useStore();
  const [displayName, setDisplayName] = useState(currentUser?.display_name || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      const updated = await api.users.updateProfile({
        display_name: displayName.trim(),
        username: username.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      updateCurrentUser(updated);
      toast.success('Profile updated!');
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const updated = await api.users.uploadAvatar(file);
      updateCurrentUser(updated);
      toast.success('Avatar updated!');
    } catch {
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>My Profile</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          {/* Avatar */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div className="profile-avatar-edit" onClick={() => fileRef.current?.click()}>
              {uploading ? (
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={24} style={{ animation: 'spin 700ms linear infinite' }} />
                </div>
              ) : (
                <Avatar user={currentUser} size="xl" />
              )}
              <div className="profile-avatar-edit-overlay">
                <Camera size={24} />
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
          </div>

          <div style={{ textAlign: 'center', marginBottom: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
            Tap camera to change photo
          </div>

          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              className="form-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))}
              placeholder="@username (optional)"
            />
          </div>
          <div className="form-group">
            <label className="form-label">About</label>
            <textarea
              className="form-input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others a bit about yourself"
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ background: 'var(--bg-input)', borderRadius: 8, padding: '10px 14px', marginTop: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Phone number</div>
            <div style={{ fontSize: 15, color: 'var(--text-primary)' }}>{currentUser?.phone}</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !displayName.trim()}>
            {saving ? <Loader2 size={16} style={{ animation: 'spin 700ms linear infinite' }} /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
