'use client';

import React from 'react';
import {
  X, User, Bell, Lock, Link,
  ChevronRight, Moon, Sun, Shield, Smartphone, HelpCircle, LogOut
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { Avatar } from './Avatar';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { currentUser, theme, toggleTheme, clearAuth } = useStore();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {}
    clearAuth();
    toast.success('Logged out');
    router.replace('/login');
  };

  const settingSections = [
    {
      items: [
        {
          icon: <User size={20} />,
          iconBg: '#3a76f0',
          title: 'Account',
          desc: 'Phone number, username, profile',
          onClick: () => toast('Account settings coming soon'),
        },
        {
          icon: <Lock size={20} />,
          iconBg: '#4CAF50',
          title: 'Privacy',
          desc: 'Blocked contacts, disappearing messages',
          onClick: () => toast('Privacy settings coming soon'),
        },
        {
          icon: <Bell size={20} />,
          iconBg: '#FF9800',
          title: 'Notifications',
          desc: 'Message, group, and other alerts',
          onClick: () => toast('Notification settings coming soon'),
        },
      ],
    },
    {
      items: [
        {
          icon: theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />,
          iconBg: '#9C27B0',
          title: 'Appearance',
          desc: theme === 'dark' ? 'Dark mode — tap to switch to Light' : 'Light mode — tap to switch to Dark',
          onClick: toggleTheme,
          rightEl: (
            <label className="toggle" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
              <span className="toggle-slider" />
            </label>
          ),
        },
        {
          icon: <Smartphone size={20} />,
          iconBg: '#607D8B',
          title: 'Linked Devices',
          desc: 'Link Signal to your tablet or computer',
          onClick: () => toast('Linked Devices coming soon'),
        },
      ],
    },
    {
      items: [
        {
          icon: <Shield size={20} />,
          iconBg: '#00BCD4',
          title: 'Security',
          desc: 'Screen lock, two-step verification',
          onClick: () => toast('Security settings coming soon'),
        },
        {
          icon: <HelpCircle size={20} />,
          iconBg: '#795548',
          title: 'Help',
          desc: 'Support, terms & privacy policy',
          onClick: () => toast('Help coming soon'),
        },
      ],
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-overlay)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 400,
          background: 'var(--bg-secondary)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 200ms ease',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          height: 'var(--header-height)',
          background: 'var(--sidebar-header-bg)',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
          <span style={{ fontWeight: 600, fontSize: 18 }}>Settings</span>
        </div>

        {/* Profile summary */}
        <div
          style={{
            padding: '20px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            cursor: 'pointer',
            borderBottom: '1px solid var(--border-color)',
            transition: 'background var(--transition-fast)',
          }}
        >
          <Avatar user={currentUser} size="lg" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 17, color: 'var(--text-primary)' }}>
              {currentUser?.display_name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {currentUser?.bio || currentUser?.phone}
            </div>
            {currentUser?.username && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                @{currentUser.username}
              </div>
            )}
          </div>
          <ChevronRight size={18} style={{ color: 'var(--text-tertiary)' }} />
        </div>

        {/* Settings list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {settingSections.map((section, si) => (
            <div key={si} className="settings-section">
              {section.items.map((item) => (
                <div key={item.title} className="settings-item" onClick={item.onClick}>
                  <div
                    className="settings-item-icon"
                    style={{ background: item.iconBg, color: '#fff' }}
                  >
                    {item.icon}
                  </div>
                  <div className="settings-item-content">
                    <div className="settings-item-title">{item.title}</div>
                    <div className="settings-item-desc">{item.desc}</div>
                  </div>
                  {item.rightEl || <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />}
                </div>
              ))}
              <div className="divider" />
            </div>
          ))}

          {/* Logout */}
          <div className="settings-item" onClick={handleLogout} style={{ color: '#e53935' }}>
            <div className="settings-item-icon" style={{ background: '#FFEBEE', color: '#e53935' }}>
              <LogOut size={20} />
            </div>
            <div className="settings-item-content">
              <div style={{ fontSize: 15, color: '#e53935', fontWeight: 500 }}>Log out</div>
            </div>
          </div>
        </div>

        {/* Version */}
        <div style={{ padding: 16, textAlign: 'center', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Signal Clone v1.0 · Built with ❤️
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
            🔒 Your messages are end-to-end encrypted
          </div>
        </div>
      </div>
    </div>
  );
}
