  import React, { useEffect, useMemo, useState, useRef } from 'react';
  import { useRouter } from 'next/router';
    import { useAuth } from '../context/AuthContext';
    import { useNotifications } from '../context/NotificationsContext';
  import UserBadge from '../components/UserBadge';
    import api from '../lib/api';
  import ConfirmModal from '../components/ConfirmModal';
    import { useToast } from '../context/ToastContext';
  import { formatStable } from '../lib/formatDate';

  type Msg = { id: number; content: string; sender: { id: number; username: string; avatar?: string | null }; createdAt: string };
  type User = { id: number; username: string; avatar?: string | null };

    export default function MessagesPage() {
      const { user } = useAuth();
      const toast = useToast();
      const currentUserAvatar = (user as any)?.avatar || (user as any)?.avatarUrl || null;

  const [inbox, setInbox] = useState<Msg[]>([]);
      const [loading, setLoading] = useState(false);
      const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
      const [replyText, setReplyText] = useState('');
      const [sending, setSending] = useState(false);
  const [threadMessages, setThreadMessages] = useState<Msg[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState<number | null>(null);
  const [confirmDeletingMessage, setConfirmDeletingMessage] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
    const [userProfiles, setUserProfiles] = useState<Record<number, any>>({});

  // Helper to resolve avatar from different possible API shapes
  const resolveAvatar = (o: any) => {
    if (!o) return null;
    // direct fields
    const direct = o?.avatarUrl || o?.avatar || o?.image || o?.picture || o?.photo || null;
    if (direct) return direct;
    // nested profile
    const nested = o?.profile?.avatarUrl || o?.profile?.avatar || null;
    if (nested) return nested;
    // fallback to cached fetched user profile by id
    if (o?.id && userProfiles[o.id]) {
      const p = userProfiles[o.id];
      return p?.avatarUrl || p?.avatar || p?.image || p?.photo || p?.profile?.avatarUrl || null;
    }
    return null;
  };

      const [users, setUsers] = useState<User[]>([]); // for "New message"
      const [newRecipientId, setNewRecipientId] = useState<number | null>(null);
      const [newText, setNewText] = useState('');

      useEffect(() => {
        if (!user) return;
        setLoading(true);
        // inbox: messages where current user is the recipient
        api.get('/api/messages')
          .then(async (r) => {
            const data = r.data || [];
            setInbox(data);
            try {
              // preload unique sender profiles (limit to first 30 to avoid storms)
              const ids = Array.from(new Set(data.map((m: any) => m.sender?.id).filter(Boolean))).slice(0, 30);
              if (ids.length) {
                const results = await Promise.all(ids.map(async (id: number) => {
                  try {
                    const res = await api.get(`/api/users/${id}`);
                    return { id, profile: res.data };
                  } catch (e) {
                    return null;
                  }
                }));
                const map: Record<number, any> = {};
                results.forEach((r) => { if (r) map[r.id] = r.profile; });
                setUserProfiles((prev) => ({ ...map, ...prev }));
              }
            } catch (e) {
              // ignore preload failures
            }
          })
          .catch(() => setInbox([]))
          .finally(() => setLoading(false));

        // fetch users for recipient selection (light-weight)
        api.get('/api/users').then((r) => setUsers(r.data || [])).catch(() => setUsers([]));
        // if opened with a ?user= query param, auto-open handled in separate effect
      }, [user]);

      // support opening a thread from a query param (e.g. /messages?user=123)
      const router = useRouter();
      useEffect(() => {
        if (!user) return;
        const q = router.query?.user;
        if (q) {
          const uid = Number(q);
          if (!Number.isNaN(uid)) selectThread(uid);
        }
      }, [router.query, user]);

      // subscribe to server "messagesRead" events so we can update the open thread
      const { addMessagesReadListener, removeMessagesReadListener } = useNotifications();
      useEffect(() => {
        if (!user) return;
        const handler = (p: any) => {
          try {
            const by = Number(p?.by);
            if (!by || Number.isNaN(by)) return;
            // if the currently open thread is with that user, mark our sent messages as read
            setThreadMessages((prev) => prev.map((m) => {
              if (m.sender.id === (user as any).id) {
                return { ...m, isRead: true, read: true, unread: false } as any;
              }
              return m;
            }));
            // optional feedback
            try { toast.show('Tus mensajes fueron leídos', 'info'); } catch (e) {}
          } catch (e) {
            // ignore malformed events
          }
        };
        addMessagesReadListener(handler);
        return () => removeMessagesReadListener(handler);
      }, [user, addMessagesReadListener, removeMessagesReadListener, toast]);

      const bySender = useMemo(() => {
        const map = new Map<number, Msg[]>();
        inbox.forEach((m) => {
          const sid = m.sender.id;
          if (!map.has(sid)) map.set(sid, []);
          map.get(sid)!.push(m);
        });
        // sort each thread by createdAt ascending
        for (const arr of map.values()) arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return map;
      }, [inbox]);

      function selectThread(uid: number) {
            setSelectedUserId(uid);
            setReplyText('');
            // locally mark inbox messages from this sender as read so unread badge disappears
            setInbox((prev) => prev.map((m) => {
              try {
                const sid = (m as any).sender?.id;
                if (sid === uid) {
                  const updated: any = { ...m };
                  // set common flags to indicate read
                  updated.isRead = true;
                  updated.read = true;
                  updated.unread = false;
                  return updated;
                }
              } catch (e) {}
              return m;
            }));
            // fetch full thread (sent + received)
            api.get(`/api/messages/thread/${uid}`).then((r) => setThreadMessages(r.data || [])).catch(() => setThreadMessages([]));
            // also fetch the sender's full profile so we can resolve avatar URLs when the message payload lacks them
            api.get(`/api/users/${uid}`).then((r) => {
              try { setUserProfiles((prev) => ({ ...prev, [uid]: r.data })); } catch (e) {}
            }).catch(() => {});
            // ensure the inbox item is visible
            setTimeout(() => {
              try {
                const el = itemRefs.current[uid];
                if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              } catch (e) {
                // ignore
              }
            }, 120);
            // also inform server we opened the thread so unread messages are marked as read
            (async () => {
              try {
                await api.post(`/api/messages/thread/${uid}/read`);
              } catch (e) {
                // ignore - non-fatal
              }
            })();
      }

      // scroll thread to bottom when messages change or when a thread is selected
      useEffect(() => {
        const el = threadRef.current;
        if (!el) return;
        // small timeout to allow DOM to render message elements
        const id = setTimeout(() => {
          el.scrollTop = el.scrollHeight;
        }, 40);
        return () => clearTimeout(id);
      }, [threadMessages, selectedUserId]);

      async function sendReply() {
        if (!selectedUserId || !replyText.trim()) return;
        setSending(true);
        try {
          await api.post('/api/messages', { recipientId: selectedUserId, content: replyText.trim() });
          toast.show('Mensaje enviado', 'success');
          setReplyText('');
          // refresh thread
          try {
            const r = await api.get(`/api/messages/thread/${selectedUserId}`);
            setThreadMessages(r.data || []);
          } catch (e) {
            // ignore
          }
        } catch (err: any) {
          toast.show(err?.response?.data?.error || 'No se pudo enviar el mensaje', 'error');
        } finally {
          setSending(false);
        }
      }

      async function saveEdit(messageId: number) {
        if (!messageId) return;
        if (!editingText.trim()) {
          toast.show('El mensaje no puede estar vacío', 'error');
          return;
        }
        setSavingEdit(true);
        try {
          // assume backend supports PUT /api/messages/:id
          await api.put(`/api/messages/${messageId}`, { content: editingText.trim() });
          toast.show('Mensaje actualizado', 'success');
          // refresh thread
          if (selectedUserId) {
            try {
              const r = await api.get(`/api/messages/thread/${selectedUserId}`);
              setThreadMessages(r.data || []);
            } catch (e) {
              // fallback: optimistic update
              setThreadMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, content: editingText.trim() } : m));
            }
          }
          // refresh inbox list (to update preview)
          try {
            const r2 = await api.get('/api/messages');
            setInbox(r2.data || []);
          } catch (e) {}
        } catch (err: any) {
          toast.show(err?.response?.data?.error || 'No se pudo actualizar el mensaje', 'error');
        } finally {
          setSavingEdit(false);
          setEditingMessageId(null);
          setEditingText('');
        }
      }

      // ask for confirmation first, then perform delete
      async function deleteMessage(messageId: number) {
        if (!messageId) return;
        setConfirmDeleteMessageId(messageId);
      }

      const performDeleteMessage = async (messageId?: number) => {
        const id = messageId ?? confirmDeleteMessageId;
        if (!id) return;
        setConfirmDeletingMessage(true);
        try {
          await api.delete(`/api/messages/${id}`);
          toast.show('Mensaje eliminado', 'success');
          // refresh thread and inbox
          if (selectedUserId) {
            try {
              const r = await api.get(`/api/messages/thread/${selectedUserId}`);
              setThreadMessages(r.data || []);
            } catch (e) {
              // optimistic removal if fetch fails
              setThreadMessages((prev) => prev.filter((m) => m.id !== id));
            }
          }
          try {
            const r2 = await api.get('/api/messages');
            setInbox(r2.data || []);
          } catch (e) {}
        } catch (err: any) {
          toast.show(err?.response?.data?.error || 'No se pudo eliminar el mensaje', 'error');
        } finally {
          setConfirmDeletingMessage(false);
          setConfirmDeleteMessageId(null);
        }
      }

      async function sendNew() {
        if (!newRecipientId || !newText.trim()) return;
        setSending(true);
        try {
          await api.post('/api/messages', { recipientId: newRecipientId, content: newText.trim() });
          toast.show('Mensaje enviado', 'success');
          setNewText('');
          // refresh inbox in case someone replied
          const r = await api.get('/api/messages');
          setInbox(r.data || []);
          // if user opened that recipient, refresh the thread
          if (selectedUserId === newRecipientId) {
            try {
              const rr = await api.get(`/api/messages/thread/${newRecipientId}`);
              setThreadMessages(rr.data || []);
            } catch (e) {}
          }
        } catch (err: any) {
          toast.show(err?.response?.data?.error || 'No se pudo enviar el mensaje', 'error');
        } finally {
          setSending(false);
        }
      }

      if (!user) return <main><h1>Inicia sesión para ver tus mensajes</h1></main>;

      return (
        <main className="messages-shell">
          <section className="messages-sidebar">
            <h2>Mensajes</h2>
            <div className="new-message">
              <label style={{ display: 'block', marginBottom: 6 }}><strong>Nuevo mensaje</strong></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    {newRecipientId ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <UserBadge user={users.find(u => u.id === newRecipientId)} size={28} showName={true} />
                        <button className="btn btn-ghost" onClick={() => setNewRecipientId(null)} type="button">Cambiar</button>
                      </div>
                    ) : (
                      <div className="muted">Selecciona un usuario...</div>
                    )}
                  </div>
                </div>

                <div className="recipients-list" style={{ maxHeight: 260, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {users.map(u => (
                    <button key={u.id} className={`card recipient-item ${newRecipientId === u.id ? 'selected' : ''}`} onClick={() => { setNewRecipientId(u.id); setSelectedUserId(u.id); setReplyText(''); setTimeout(()=>{ try{ (document.querySelector('#composer-textarea') as HTMLTextAreaElement)?.focus(); }catch(e){} },120); }} type="button" style={{ textAlign: 'left', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <UserBadge user={u} size={28} showName={true} />
                    </button>
                  ))}
                </div>
            </div>
            </div>

                <div>
                  <h3>Inbox</h3>
              {loading && <div>Cargando...</div>}
              {!loading && inbox.length === 0 && <div>No tienes mensajes</div>}
              <div className="inbox-list" style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 auto', overflow: 'auto' }}>
                {Array.from(bySender.entries()).map(([sid, msgs]) => {
                  const sender = msgs[0].sender;
                  const avatar = resolveAvatar(sender);
                  const isSelected = selectedUserId === sid;
                  const unreadCount = msgs.filter(m => {
                    const anyMsg: any = m as any;
                    // support multiple possible flags from API: isRead, read, unread
                    if (typeof anyMsg.isRead === 'boolean') return anyMsg.isRead === false;
                    if (typeof anyMsg.read === 'boolean') return anyMsg.read === false;
                    if (typeof anyMsg.unread === 'boolean') return anyMsg.unread === true;
                    return false;
                  }).length;
                  return (
                    <button key={sid} ref={(el) => { itemRefs.current[sid] = el; }} className={`card inbox-item ${isSelected ? 'selected' : ''}`} onClick={() => selectThread(sid)} style={{ textAlign: 'left' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%' }}>
                        {avatar ? (
                          <img src={avatar} alt={`${sender.username} avatar`} className="avatar-neon" onError={(e) => { (e.target as HTMLImageElement).onerror = null; (e.target as HTMLImageElement).src = '/avatar-fallback.svg'; }} />
                        ) : (
                          <div className="avatar-neon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e6e6e6', fontWeight: 700 }}>
                            {sender.username.slice(0,1).toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sender.username}</strong>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span className="muted" style={{ marginLeft: 8 }}>{formatStable(msgs[msgs.length-1].createdAt)}</span>
                              {unreadCount > 0 && <span className="badge-unread">{unreadCount}</span>}
                            </div>
                          </div>
                          <div className="muted" style={{ marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msgs[msgs.length-1].content}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
    </section>

          <section className="messages-content">
            {!selectedUserId ? (
              <div className="card"><p>Selecciona una conversación para ver el hilo.</p></div>
            ) : (
              <div className="thread-window">
                <div className="thread-header card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {(() => {
                        const headerSender = bySender.get(selectedUserId)?.[0]?.sender;
                        const merged = headerSender && headerSender.id && userProfiles[headerSender.id] ? { ...headerSender, ...userProfiles[headerSender.id] } : headerSender;
                        return <UserBadge user={merged} showName={true} />;
                      })()}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button className="btn btn-ghost" onClick={() => { setSelectedUserId(null); }}>Cerrar</button>
                    </div>
                  </div>
                </div>

                <div className="thread-messages" ref={threadRef}>
                  {threadMessages.map(m => {
                    const sender = m.sender;
                    const mine = m.sender.id === user?.id;
                    return (
                      <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', alignSelf: mine ? 'flex-end' : 'flex-start', flexDirection: mine ? 'row-reverse' : 'row', maxWidth: '80%' }}>
                                {(() => {
                                  // prefer the avatar from the message sender; if this is the current user's message and sender has no avatar, use current user's avatar from context
                                  const msgAvatar = resolveAvatar(sender);
                                  const displayAvatar = msgAvatar ?? (mine ? currentUserAvatar : null);
                                  if (displayAvatar) {
                                    return <img src={displayAvatar} alt={`${sender.username} avatar`} className="avatar-neon-sm" onError={(e) => { (e.target as HTMLImageElement).onerror = null; (e.target as HTMLImageElement).src = '/avatar-fallback.svg'; }} />;
                                  }
                                  return (
                                    <div className="avatar-neon-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e6e6e6', fontWeight: 700 }}>
                                      {sender.username.slice(0,1).toUpperCase()}
                                    </div>
                                  );
                                })()}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: mine ? 'flex-end' : 'flex-start' }}>
                            <div className={`card msg-bubble ${mine ? 'mine' : 'other'}`} style={{ padding: 10, minWidth: 160 }}>
                              <div className="muted" style={{ fontSize: 12 }}>{formatStable(m.createdAt)}</div>
                              {/* if this message is being edited, show textarea */}
                              {editingMessageId === m.id ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                                  <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} style={{ width: 360, maxWidth: '60vw', minHeight: 80, padding: 8, borderRadius: 8 }} />
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-primary" onClick={() => saveEdit(m.id)} disabled={savingEdit}>{savingEdit ? 'Guardando...' : 'Guardar'}</button>
                                    <button className="btn btn-ghost" onClick={() => { setEditingMessageId(null); setEditingText(''); }} type="button">Cancelar</button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ marginTop: 6 }}>{m.content}</div>
                              )}
                            </div>
                            {/* actions row for messages I own */}
                            {mine && editingMessageId !== m.id && (
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-ghost" onClick={() => { setEditingMessageId(m.id); setEditingText(m.content); }} type="button">Editar</button>
                                <button className="btn btn-ghost" onClick={() => deleteMessage(m.id)} type="button">Eliminar</button>
                              </div>
                            )}
                          </div>
                        </div>
                    );
                  })}
                </div>
                {/* Confirm delete message modal */}
                <ConfirmModal open={!!confirmDeleteMessageId} title="Eliminar mensaje" description="¿Eliminar este mensaje? Esta acción no se puede deshacer." confirmLabel="Eliminar" cancelLabel="Cancelar" loading={confirmDeletingMessage} onCancel={() => setConfirmDeleteMessageId(null)} onConfirm={() => performDeleteMessage()} />
                <div className="composer card">
                  <label className="muted">Responder a {(() => {
                    const headerSender = bySender.get(selectedUserId)?.[0]?.sender;
                    const merged = headerSender && headerSender.id && userProfiles[headerSender.id] ? { ...headerSender, ...userProfiles[headerSender.id] } : headerSender;
                    return <UserBadge user={merged} showName={true} />;
                  })()}</label>
                  <textarea id="composer-textarea" ref={(el)=>{ /* focus handled on selection */ }} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Escribe tu respuesta..." aria-label="Escribe tu respuesta" style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 8, maxHeight: 160, overflowY: 'auto', resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-primary" onClick={sendReply} disabled={sending || !replyText.trim()}>{sending ? 'Enviando...' : 'Responder'}</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      );
    }
