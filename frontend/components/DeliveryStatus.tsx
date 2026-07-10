'use client';

import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import type { Message } from '@/lib/types';

interface DeliveryStatusProps {
  message: Message;
  currentUserId: string;
  size?: number;
}

export function DeliveryStatus({ message, currentUserId, size = 16 }: DeliveryStatusProps) {
  if (message.sender_id !== currentUserId) return null;

  const recipientStatuses = message.statuses.filter((s) => s.user_id !== currentUserId);

  if (recipientStatuses.length === 0) {
    return (
      <span className="delivery-icon">
        <Check size={size} />
      </span>
    );
  }

  const allRead = recipientStatuses.every((s) => s.status === 'read');
  const anyDelivered = recipientStatuses.some((s) =>
    ['delivered', 'read'].includes(s.status)
  );

  if (allRead) {
    return (
      <span className="delivery-icon read" title="Read">
        <CheckCheck size={size} />
      </span>
    );
  }

  if (anyDelivered) {
    return (
      <span className="delivery-icon delivered" title="Delivered">
        <CheckCheck size={size} />
      </span>
    );
  }

  return (
    <span className="delivery-icon" title="Sent">
      <Check size={size} />
    </span>
  );
}
