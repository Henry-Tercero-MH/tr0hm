import React, { useEffect, useState } from 'react';
import { useNotifications } from '../context/NotificationsContext';
import api from '../lib/api';
import { useRouter } from 'next/router';
import UserBadge from './UserBadge';
import { formatStable, formatCompact } from '../lib/formatDate';

export default function NotificationsDropdown() {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [usersCache, setUsersCache] = useState<Record<number, any>>({});
  const router = useRouter();

  // when opening, preload actor user profiles so we can show avatar + name
  useEffect(() => {
    if (!open) return;
    const ids = new Set<number>();
    notifications.forEach((n) => {
      const id = (n.payload && (n.payload.from || n.payload.userId || n.payload.followerId)) as number | undefined;
      if (id && !usersCache[id]) ids.add(id);
    });
    if (ids.size === 0) return;
    // fetch in parallel
    ids.forEach((id) => {
      api.get(`/api/users/${id}`).then((r) => {
        setUsersCache((prev) => ({ ...prev, [id]: r.data }));
      }).catch(() => {
        // ignore missing
      });
    });
  }, [open, notifications]);

  async function handleClick(n: any) {
    try {
      await markAsRead(n.id);
    } catch (e) {
      // ignore
    }
    setOpen(false);

    // route depending on notification type and payload
    const payload = n.payload || {};
    if (n.type === 'message') {
      const actor = payload.from || payload.userId;
      // navigate to messages and hint which user to open via query param
      if (actor) router.push(`/messages?user=${actor}`);
      else router.push('/messages');
      return;
    }

    if (n.type === 'comment') {
      const postId = payload.postId;
      const commentId = payload.commentId;
      if (postId) {
        const hash = commentId ? `#comment-${commentId}` : '';
        router.push(`/posts/${postId}${hash}`);
        return;
      }
    }

    if (n.type === 'like') {
      const postId = payload.postId;
      if (postId) {
        router.push(`/posts/${postId}`);
        return;
      }
    }

    if (n.type === 'follow') {
      const followerId = payload.followerId;
      if (followerId) {
        router.push(`/users/${followerId}`);
        return;
      }
    }

    // fallback: open notifications page or home
    router.push('/');
  }

  return (
    <div className="position-relative ms-2">
      <button 
        className="btn btn-ghost position-relative" 
        onClick={() => setOpen(!open)} 
        aria-label="Notifications"
        style={{ fontSize: '20px' }}
      >
        🔔
        {unreadCount > 0 && (
          <span 
            className="position-absolute top-0 start-100 translate-middle badge rounded-pill"
            style={{
              background: 'var(--primary)',
              color: '#fff',
              fontSize: '10px',
              padding: '3px 6px',
              minWidth: '18px',
              fontWeight: 700
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div 
            className="position-fixed top-0 start-0 w-100 h-100" 
            style={{ zIndex: 39 }}
            onClick={() => setOpen(false)}
          />
          <div className="dropdown-menu show dropdown-menu-end p-0" style={{ zIndex: 40, position: 'absolute', right: 0, top: '100%', marginTop: '8px' }}>
            <div className="notifications-dropdown">
              <div className="border-bottom">
                <strong>Notificaciones</strong>
              </div>
              <div style={{ maxHeight: 460 }}>
                {notifications.length === 0 && (
                  <div className="p-3">
                    <div style={{ opacity: 0.6, fontSize: '48px', marginBottom: '12px' }}>🔔</div>
                    <div>No hay notificaciones</div>
                  </div>
                )}
                {notifications.map((n) => {
                const payload = n.payload || {};
                const actorId = payload.from || payload.userId || payload.followerId || null;
                const actor = actorId ? usersCache[actorId] : null;

                // build a friendly title and subtitle
                let title = '';
                let subtitle = '';
                if (n.type === 'message') {
                  title = actor ? `${actor.username} te envió un mensaje` : 'Tienes un mensaje nuevo';
                  subtitle = payload.preview || '';
                } else if (n.type === 'comment') {
                  title = actor ? `${actor.username} comentó en tu publicación` : 'Nuevo comentario';
                  subtitle = payload.preview || '';
                } else if (n.type === 'like') {
                  title = actor ? `${actor.username} dio me gusta` : 'Nueva reacción';
                  subtitle = '';
                } else if (n.type === 'follow') {
                  title = actor ? `${actor.username} comenzó a seguirte` : 'Nuevo seguidor';
                  subtitle = '';
                } else {
                  title = n.type || 'Notificación';
                  subtitle = payload.info || '';
                }

                return (
                  <button 
                    key={n.id} 
                    className={`notification ${!n.read ? 'unread' : ''} w-100 text-start`} 
                    onClick={() => handleClick(n)}
                  >
                    <div className="flex-shrink-0 me-3" style={{ width: 52, height: 52 }}>
                      {actor ? (
                        <UserBadge user={actor} size={52} showName={false} />
                      ) : (
                        <div className="avatar-neon d-flex align-items-center justify-content-center" style={{ width: 52, height: 52, fontWeight: 700, borderRadius: '50%', fontSize: '20px' }}>
                          {(actorId ? String(actorId).slice(0,1) : 'N')}
                        </div>
                      )}
                    </div>
                    <div className="flex-grow-1" style={{ minWidth: 0, paddingRight: '8px' }}>
                      <div className="d-flex justify-content-between align-items-start mb-2" style={{ gap: 12 }}>
                        <div className="text-truncate fw-semibold" style={{ fontSize: '15px', lineHeight: '1.5' }}>{title}</div>
                        <div className="time" style={{ fontSize: '12.5px', whiteSpace: 'nowrap', marginLeft: 'auto' }}>{formatCompact(n.createdAt)}</div>
                      </div>
                      {subtitle ? <div className="muted text-truncate" style={{ fontSize: '13.5px', lineHeight: '1.5', marginTop: '4px' }}>{subtitle}</div> : null}
                    </div>
                    {!n.read && (
                      <div className="align-self-start ms-2" style={{ marginTop: '16px' }}>
                        <span className="badge-unread" />
                      </div>
                    )}
                  </button>
                );
              })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
