import React, { useEffect, useState } from 'react';
import { useNotifications } from '../context/NotificationsContext';
import api from '../lib/api';
import { useRouter } from 'next/router';
import UserBadge from './UserBadge';
import { formatStable } from '../lib/formatDate';

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
      const id = (n.payload && (n.payload.from || n.payload.userId || n.payload.userId)) as number | undefined;
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

    // fallback: open notifications page or home
    router.push('/');
  }

  return (
    <div className="position-relative" style={{ marginLeft: 12 }}>
      <button className="btn btn-ghost" onClick={() => setOpen(!open)} aria-label="Notifications">
        🔔 {unreadCount > 0 ? `(${unreadCount})` : ''}
      </button>
      {open && (
        <div className="dropdown-menu show dropdown-menu-end p-0" style={{ zIndex: 40 }}>
          <div className="notifications-dropdown card">
            <div className="p-2 border-bottom"><strong>Notificaciones</strong></div>
            <div style={{ maxHeight: 320, overflow: 'auto' }}>
              {notifications.length === 0 && <div style={{ padding: 12 }}>No hay notificaciones</div>}
              {notifications.map((n) => {
                const payload = n.payload || {};
                const actorId = payload.from || payload.userId || null;
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
                } else {
                  title = n.type || 'Notificación';
                  subtitle = payload.info || '';
                }

                return (
                  <button key={n.id} className={`notification ${!n.read ? 'unread' : ''} dropdown-item`} onClick={() => handleClick(n)} style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 12, padding: 10, alignItems: 'center' }}>
                    <div style={{ width: 44, height: 44, flex: '0 0 44px' }}>
                      {actor ? (
                        <UserBadge user={actor} size={44} showName={false} />
                      ) : (
                        <div className="avatar-neon" style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{(actorId ? String(actorId).slice(0,1) : 'N')}</div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{title}</div>
                        <div className="time" style={{ flex: '0 0 auto' }}>{formatStable(n.createdAt)}</div>
                      </div>
                      {subtitle ? <div className="muted" style={{ marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div> : null}
                    </div>
                    <div style={{ marginLeft: 8, alignSelf: 'center' }}>{!n.read && <span className="badge-unread" />}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
