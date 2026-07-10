'use client';

import React from 'react';
import type { User } from '@/lib/types';

// Deterministic color based on user id / name
const COLORS = [
  '#E57373', '#F06292', '#BA68C8', '#9575CD',
  '#7986CB', '#64B5F6', '#4DD0E1', '#4DB6AC',
  '#81C784', '#DCE775', '#FFB74D', '#FF8A65',
];

function getColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface AvatarProps {
  user?: User | null;
  name?: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showOnline?: boolean;
  isOnline?: boolean;
  className?: string;
}

const SIZE_MAP = { sm: 34, md: 46, lg: 60, xl: 80 };

export function Avatar({
  user,
  name,
  src,
  size = 'md',
  showOnline = false,
  isOnline = false,
  className = '',
}: AvatarProps) {
  const displayName = user?.display_name || name || '?';
  const avatarSrc = src || user?.avatar_url;
  const online = isOnline || user?.is_online || false;
  const px = SIZE_MAP[size];
  const bgColor = getColor(user?.id || displayName);
  const fontSize = { sm: 13, md: 18, lg: 22, xl: 30 }[size];

  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const fullSrc = avatarSrc
    ? avatarSrc.startsWith('http')
      ? avatarSrc
      : `${BASE_URL}${avatarSrc}`
    : null;

  return (
    <div
      className={`avatar avatar-${size} ${className}`}
      style={{ width: px, height: px, background: fullSrc ? undefined : bgColor, fontSize }}
    >
      {fullSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fullSrc}
          alt={displayName}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        />
      ) : (
        <span>{getInitials(displayName)}</span>
      )}
      {showOnline && online && <div className="online-indicator" />}
    </div>
  );
}

interface GroupAvatarProps {
  users: User[];
  size?: 'sm' | 'md' | 'lg';
}

export function GroupAvatar({ users, size = 'md' }: GroupAvatarProps) {
  const displayed = users.slice(0, 2);
  const px = SIZE_MAP[size];

  return (
    <div style={{ position: 'relative', width: px, height: px, flexShrink: 0 }}>
      {displayed.map((u, i) => (
        <div
          key={u.id}
          style={{
            position: 'absolute',
            width: px * 0.65,
            height: px * 0.65,
            borderRadius: '50%',
            background: getColor(u.id),
            border: '2px solid var(--sidebar-bg)',
            top: i === 0 ? 0 : undefined,
            bottom: i === 1 ? 0 : undefined,
            left: i === 0 ? 0 : undefined,
            right: i === 0 ? 0 : undefined,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 600,
            fontSize: px * 0.65 * 0.35,
            overflow: 'hidden',
          }}
        >
          {u.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={u.avatar_url.startsWith('http') ? u.avatar_url : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${u.avatar_url}`}
              alt={u.display_name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            getInitials(u.display_name)
          )}
        </div>
      ))}
    </div>
  );
}
