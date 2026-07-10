'use client';

import React from 'react';
import { use } from 'react';
import { ChatPane } from '@/components/ChatPane';

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ChatPane conversationId={id} />;
}
