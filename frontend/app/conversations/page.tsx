'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function ConversationsPage() {
  return (
    <div className="chat-pane">
      <div className="chat-pane-empty">
        <div className="chat-pane-empty-icon">
          <MessageSquare size={40} strokeWidth={1.5} />
        </div>
        <h2>Signal</h2>
        <p>Select a conversation to start messaging, or create a new one.</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>🔒 Your messages are end-to-end encrypted</p>
      </div>
    </div>
  );
}
