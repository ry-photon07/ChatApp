'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

export default function ConversationFallbackPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const setActiveConversation = useStore((s) => s.setActiveConversation);

  useEffect(() => {
    setActiveConversation(id);
    router.replace('/conversations');
  }, [id, router, setActiveConversation]);

  return null;
}
