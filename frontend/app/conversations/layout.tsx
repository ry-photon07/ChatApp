'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useWebSocket } from '@/lib/websocket';
import api from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { ChatPane } from '@/components/ChatPane';
import { SettingsPanel } from '@/components/SettingsPanel';
import toast from 'react-hot-toast';

export default function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, currentUser, setConversations, setAuth } = useStore();
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Initialize WS
  useWebSocket();

  useEffect(() => {
    if (!token) {
      router.replace('/login');
      return;
    }

    const init = async () => {
      try {
        // Verify token still valid
        const user = await api.auth.me();
        if (!currentUser) {
          useStore.getState().updateCurrentUser(user);
        }

        // Load conversations
        const convs = await api.conversations.list();
        setConversations(convs);
      } catch {
        toast.error('Session expired. Please log in again.');
        useStore.getState().clearAuth();
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [token, router, setConversations, currentUser]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar onOpenSettings={() => setShowSettings(true)} />
      {children}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
