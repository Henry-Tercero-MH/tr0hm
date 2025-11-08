import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../lib/api';
import FollowButton from './FollowButton';

type U = { id?: number; username?: string; avatarUrl?: string | null; avatar?: string | null; isOnline?: boolean } | null | undefined;

export default function UserBadge({ user, size = 28, link = false, showName = true, className = '', showOnlineStatus = true }: { user?: U; size?: number; link?: boolean; showName?: boolean; className?: string; showOnlineStatus?: boolean }) {
  const PLACEHOLDER = '/avatar-fallback.svg';
  const { user: me } = useAuth();
  const toast = useToast();

  // Follow button handled by reusable FollowButton component (fetches status + actions)

  // Support both `avatarUrl` (new) and `avatar` (legacy) fields coming from different APIs
  const avatar = (user as any)?.avatarUrl || (user as any)?.avatar || null;
  const name = user?.username || 'Anon';

  const img = (
    <div className="position-relative d-inline-block">
      <img
        src={avatar || PLACEHOLDER}
        onError={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; e.currentTarget.src = PLACEHOLDER; }}
        alt={`${name} avatar`}
        style={{ width: size, height: size, objectFit: 'cover' }}
        className={`rounded-circle user-badge-avatar ${className}`}
      />
      {showOnlineStatus && (user as any)?.isOnline && (
        <span 
          className="online-indicator"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: size * 0.28,
            height: size * 0.28,
            backgroundColor: '#25D366',
            border: '2px solid var(--bg)',
            borderRadius: '50%',
            boxShadow: '0 0 4px rgba(37, 211, 102, 0.5)'
          }}
        />
      )}
    </div>
  );

  const initials = (
    <div className="position-relative d-inline-block">
      <div className={`avatar ${className}`} style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {name.slice(0, 1).toUpperCase()}
      </div>
      {showOnlineStatus && (user as any)?.isOnline && (
        <span 
          className="online-indicator"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: size * 0.28,
            height: size * 0.28,
            backgroundColor: '#25D366',
            border: '2px solid var(--bg)',
            borderRadius: '50%',
            boxShadow: '0 0 4px rgba(37, 211, 102, 0.5)'
          }}
        />
      )}
    </div>
  );

  const avatarNode = avatar ? img : initials;

  const content = (
    <div className="d-inline-flex align-items-center" style={{ gap: 8 }}>
      {avatarNode}
      {showName ? (
        <div style={{ maxWidth: 160 }} className="text-truncate">
          <strong className="me-1">{name}</strong>
        </div>
      ) : null}
      {/* follow/request button: only show when viewing other users */}
      {user && me && user.id && me.id !== user.id && (
        <div className="ms-2">
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
