import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../lib/api';
import FollowButton from './FollowButton';

type U = { id?: number; username?: string; avatarUrl?: string | null; avatar?: string | null } | null | undefined;

export default function UserBadge({ user, size = 28, link = false, showName = true, className = '' }: { user?: U; size?: number; link?: boolean; showName?: boolean; className?: string }) {
  const PLACEHOLDER = '/avatar-fallback.svg';
  const { user: me } = useAuth();
  const toast = useToast();

  // Follow button handled by reusable FollowButton component (fetches status + actions)

  // Support both `avatarUrl` (new) and `avatar` (legacy) fields coming from different APIs
  const avatar = (user as any)?.avatarUrl || (user as any)?.avatar || null;
  const name = user?.username || 'Anon';

  const img = (
    <img
      src={avatar || PLACEHOLDER}
      onError={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; e.currentTarget.src = PLACEHOLDER; }}
      alt={`${name} avatar`}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      className={`user-badge-avatar ${className}`}
    />
  );

  const initials = (
    <div className={`avatar ${className}`} style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );

  const avatarNode = avatar ? img : initials;

  const content = (
    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      {avatarNode}
      {showName ? <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</strong> : null}
      {/* follow/request button: only show when viewing other users */}
      {user && me && user.id && me.id !== user.id && (
        <div style={{ marginLeft: 8 }}>
          <FollowButton userId={user.id as number} compact />
        </div>
      )}
    </div>
  );

  if (link && user && user.id) {
    return <Link href={`/users/${user.id}`}>{content}</Link>;
  }
  return content;
}

// Follow status and actions are handled by `FollowButton` (keeps this component small)
