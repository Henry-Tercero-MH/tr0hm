import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import api from '../lib/api';
import ConfirmModal from '../components/ConfirmModal';
import UserBadge from '../components/UserBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

type Post = {
  id: number;
  content: string;
  mediaUrl?: string;
  author: { id: number; username: string; avatarUrl?: string };
  createdAt: string;
  _count?: { likes?: number; comments?: number };
};

type Comment = { id: number; content: string; author: { id: number; username: string; avatarUrl?: string }; createdAt: string };

import { formatStable } from '../lib/formatDate';

export default function Home({ posts: initialPosts, page, total }: { posts: Post[]; page: number; total?: number }) {
  const { user } = useAuth();
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>(initialPosts || []);
  const [likedMap, setLikedMap] = useState<Record<number, boolean>>({});
  const [commentOpen, setCommentOpen] = useState<Record<number, boolean>>({});
  const [commentText, setCommentText] = useState<Record<number, string>>({});
  const [commentsMap, setCommentsMap] = useState<Record<number, Comment[]>>({});
  const [pendingComments, setPendingComments] = useState<Record<number, boolean>>({});
  const [newPostText, setNewPostText] = useState('');
  const [creatingPost, setCreatingPost] = useState(false);
  // Stories
  type Story = { id: number; userId: number; author: { id: number; username: string; avatarUrl?: string | null } | null; mediaUrl?: string | null; text?: string | null; createdAt: string; expiresAt: string };
  const [stories, setStories] = useState<Story[]>([]);
  const [newStoryMedia, setNewStoryMedia] = useState('');
  const [newStoryText, setNewStoryText] = useState('');
  const [creatingStory, setCreatingStory] = useState(false);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [viewingPaused, setViewingPaused] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // post edit/delete state
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editingPostText, setEditingPostText] = useState('');
  const [savingPostEdit, setSavingPostEdit] = useState(false);
  const [openPostMenuId, setOpenPostMenuId] = useState<number | null>(null);
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<number | null>(null);
  const [confirmDeletingPost, setConfirmDeletingPost] = useState(false);
  const [confirmDeleteStoryId, setConfirmDeleteStoryId] = useState<number | null>(null);
  const [confirmDeletingStory, setConfirmDeletingStory] = useState(false);

  useEffect(() => {
    setPosts(initialPosts || []);
  }, [initialPosts]);

  // close post menu on outside clicks
  useEffect(() => {
    const handler = () => setOpenPostMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // fetch stories (public)
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/stories');
        setStories(r.data || []);
      } catch (err) {
        console.error('fetch stories', err);
      }
    })();
  }, []);

      {/* Create Story modal for mobile */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCreateModal(false)}>
          <div className="modal" style={{ background: '#fff', padding: 16, borderRadius: 8, maxWidth: 420, width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>Añadir Historia</strong>
              <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)} aria-label="Cerrar">✕</button>
            </div>
            <form onSubmit={submitStory}>
              <input className="form-control mb-2" placeholder="Image URL" value={newStoryMedia} onChange={(e) => setNewStoryMedia(e.target.value)} />
              <input className="form-control mb-2" placeholder="Texto (opcional)" value={newStoryText} onChange={(e) => setNewStoryText(e.target.value)} />
              <div>
                <button className="btn btn-primary w-100" type="submit" disabled={creatingStory}>{creatingStory ? 'Publicando...' : 'Añadir'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
  // On auth change, fetch liked states for posts
  useEffect(() => {
    if (!user) return;
    (async () => {
      const map: Record<number, boolean> = {};
      await Promise.all(posts.map(async (p) => {
        try {
          const r = await api.get(`/api/posts/${p.id}/like`);
          map[p.id] = !!r.data?.liked;
        } catch (e) {
          map[p.id] = false;
        }
      }));
      setLikedMap(map);
    })();
  }, [user, posts]);

  const limit = 10;
  const totalPages = total ? Math.ceil(total / limit) : undefined;

  const toggleLike = async (e: React.MouseEvent, postId: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) return alert('Debes iniciar sesión');
    const liked = likedMap[postId];
    try {
      if (!liked) {
        await api.post(`/api/posts/${postId}/like`);
        setLikedMap((s) => ({ ...s, [postId]: true }));
        setPosts((ps) => ps.map((x) => x.id === postId ? ({ ...x, _count: { ...(x._count||{}), likes: (x._count?.likes||0) + 1 } }) : x));
      } else {
        await api.delete(`/api/posts/${postId}/like`);
        setLikedMap((s) => ({ ...s, [postId]: false }));
        setPosts((ps) => ps.map((x) => x.id === postId ? ({ ...x, _count: { ...(x._count||{}), likes: Math.max(0, (x._count?.likes||1) - 1) } }) : x));
      }
    } catch (err) {
      console.error('like error', err);
    }
  };

  const sharePost = async (e: React.MouseEvent, postId: number) => {
    e.stopPropagation();
    e.preventDefault();
    const url = `${window.location.origin}/posts/${postId}`;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: 'Tr0hm', text: 'Mira esta publicación', url });
        toast.show('Compartido', 'success');
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        toast.show('Enlace copiado al portapapeles', 'success');
      } else {
        // fallback prompt
        // eslint-disable-next-line no-alert
        window.prompt('Copia el enlace', url);
      }
    } catch (err) {
      // user probably cancelled native share or clipboard failed
      console.error('share error', err);
      toast.show('No se pudo compartir', 'error');
    }
  };

  const fetchComments = async (postId: number) => {
    try {
      const list = await api.get(`/api/posts/${postId}/comments`);
      setCommentsMap((m) => ({ ...m, [postId]: list.data }));
    } catch (err) {
      console.error('fetch comments error', err);
      setCommentsMap((m) => ({ ...m, [postId]: [] }));
    }
  };

  const toggleComments = async (e: React.MouseEvent, postId: number) => {
    e.stopPropagation();
    e.preventDefault();
    setCommentOpen((s) => {
      const next = !s[postId];
      if (next && !commentsMap[postId]) {
        // fetch comments when opening
        fetchComments(postId);
      }
      return { ...s, [postId]: next };
    });
  };

  const submitComment = async (e: React.FormEvent, postId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return alert('Debes iniciar sesión');
    const text = commentText[postId];
    if (!text || text.trim().length === 0) return;

  // Optimistic UI: insert temporary comment at the top and bump counter
  const prevComments = commentsMap[postId] || [];
  setPendingComments((s) => ({ ...s, [postId]: true }));
    const tempId = -Date.now();
    const optimistic: Comment = {
      id: tempId as unknown as number,
      content: text,
      author: { id: user.id as number, username: user.username as string, avatarUrl: (user as any).avatarUrl },
      createdAt: new Date().toISOString(),
    };

    // Apply optimistic update
    setCommentsMap((m) => ({ ...m, [postId]: [optimistic, ...(m[postId] || [])] }));
    setPosts((ps) => ps.map((x) => x.id === postId ? ({ ...x, _count: { ...(x._count||{}), comments: (x._count?.comments||0) + 1 } }) : x));
    setCommentText((s) => ({ ...s, [postId]: '' }));
    setCommentOpen((s) => ({ ...s, [postId]: true }));

    try {
      const r = await api.post(`/api/posts/${postId}/comments`, { content: text });
      // replace optimistic comment with server result (keeping author info from current session)
      const server = r.data;
      const full: Comment = {
        id: server.id,
        content: server.content,
        author: { id: user.id as number, username: user.username as string, avatarUrl: (user as any).avatarUrl },
        createdAt: server.createdAt,
      };
      setCommentsMap((m) => ({ ...m, [postId]: (m[postId] || []).map((c) => c.id === tempId ? full : c) }));
      toast.show('Comentario enviado', 'success');
    } catch (err) {
      console.error('comment error', err);
      // rollback optimistic update
      setCommentsMap((m) => ({ ...m, [postId]: prevComments }));
      setPosts((ps) => ps.map((x) => x.id === postId ? ({ ...x, _count: { ...(x._count||{}), comments: Math.max(0, (x._count?.comments||1) - 1) } }) : x));
      toast.show('No se pudo enviar el comentario', 'error');
    } finally {
      setPendingComments((s) => ({ ...s, [postId]: false }));
    }
  };

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert('Debes iniciar sesión');
    if (!newPostText || newPostText.trim().length === 0) return;
    setCreatingPost(true);
    try {
      const r = await api.post('/api/posts', { content: newPostText });
      // prepend new post to feed
      setPosts((s) => [r.data, ...s]);
      setNewPostText('');
      toast.show('Publicación creada', 'success');
    } catch (err) {
      console.error('create post error', err);
      toast.show('No se pudo crear la publicación', 'error');
    } finally {
      setCreatingPost(false);
    }
  };

  const savePostEdit = async (postId: number) => {
    if (!postId) return;
    if (!editingPostText.trim()) return toast.show('El contenido no puede estar vacío', 'error');
    setSavingPostEdit(true);
    try {
      await api.put(`/api/posts/${postId}`, { content: editingPostText.trim() });
      // optimistic update: update posts state
      setPosts((ps) => ps.map((x) => x.id === postId ? ({ ...x, content: editingPostText.trim() }) : x));
      toast.show('Publicación actualizada', 'success');
    } catch (err) {
      console.error('save post edit', err);
      toast.show('No se pudo actualizar la publicación', 'error');
    } finally {
      setSavingPostEdit(false);
      setEditingPostId(null);
      setEditingPostText('');
    }
  };

  // ask for confirmation via modal (sets id to confirm)
  const deletePost = async (postId: number) => {
    if (!postId) return;
    setConfirmDeletePostId(postId);
  };

  const performDeletePost = async (postId?: number) => {
    const id = postId ?? confirmDeletePostId;
    if (!id) return;
    setConfirmDeletingPost(true);
    try {
      await api.delete(`/api/posts/${id}`);
      setPosts((ps) => ps.filter((x) => x.id !== id));
      toast.show('Publicación eliminada', 'success');
    } catch (err) {
      console.error('delete post', err);
      toast.show('No se pudo eliminar la publicación', 'error');
    } finally {
      setConfirmDeletingPost(false);
      setConfirmDeletePostId(null);
    }
  };

  const submitStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert('Debes iniciar sesión');
    if (!newStoryMedia && (!newStoryText || newStoryText.trim().length === 0)) return;
    setCreatingStory(true);
    const optimistic: Story = {
      id: -Date.now() as unknown as number,
      userId: user.id as number,
      author: { id: user.id as number, username: user.username as string, avatarUrl: (user as any).avatarUrl },
      mediaUrl: newStoryMedia || null,
      text: newStoryText || null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  // optimistic prepend
  setStories((s) => [optimistic, ...s]);
  // mark as pending visually by leaving id negative (we'll detect negative id as pending)
    setNewStoryMedia('');
    setNewStoryText('');
    try {
      const r = await api.post('/api/stories', { mediaUrl: optimistic.mediaUrl, text: optimistic.text });
      const server = r.data as Story;
      setStories((s) => [server, ...s.filter((x) => x.id !== optimistic.id)]);
      // close modal (if open on mobile)
      setShowCreateModal(false);
      toast.show('Historia creada', 'success');
    } catch (err) {
      console.error('create story', err);
      // rollback
      setStories((s) => s.filter((x) => x.id !== optimistic.id));
      toast.show('No se pudo crear la historia', 'error');
    } finally {
      setCreatingStory(false);
    }
  };

  const performDeleteStory = async (storyId?: number) => {
    const id = storyId ?? confirmDeleteStoryId;
    if (!id) return;
    setConfirmDeletingStory(true);
    try {
      await api.delete(`/api/stories/${id}`);
      setStories((s) => s.filter((x) => x.id !== id));
      // if the deleted story was open in viewer, close it
      if (viewingStory && viewingStory.id === id) {
        setViewingStory(null);
        setViewingIndex(null);
      }
      toast.show('Historia eliminada', 'success');
    } catch (err) {
      console.error('delete story', err);
      toast.show('No se pudo eliminar', 'error');
    } finally {
      setConfirmDeletingStory(false);
      setConfirmDeleteStoryId(null);
    }
  };

  // Open viewer by index helper
  const openStoryByIndex = (idx: number) => {
    const s = stories[idx];
    if (!s) return;
    setViewingIndex(idx);
    setViewingStory(s);
    setViewingPaused(false);
  };

  const openStoryOrCreate = (idx: number) => {
    // on small screens open the create modal instead of directly opening the story viewer
    if (isClient && window.innerWidth <= 520) {
      setShowCreateModal(true);
      return;
    }
    openStoryByIndex(idx);
  };

  // Autoplay: advance every N ms unless paused
  useEffect(() => {
    if (viewingIndex === null || viewingStory === null) return;
    const duration = 5000; // 5s per story
    let elapsed = 0;
    let raf: number | null = null;

    const tick = () => {
      if (viewingPaused) {
        raf = requestAnimationFrame(tick);
        return;
      }
      elapsed += 250;
      if (elapsed >= duration) {
        // advance
        const next = viewingIndex + 1;
        if (next >= stories.length) {
          setViewingStory(null);
          setViewingIndex(null);
        } else {
          setViewingIndex(next);
          setViewingStory(stories[next]);
        }
      } else {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingIndex, viewingStory, viewingPaused, stories]);

  // avoid using Date.now() during SSR (hydration mismatch). only compute progress on client
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  return (
    <main className="container my-4">
      {/* Stories bar */}
      <section className="stories-section">
        <div className="stories-bar d-flex gap-3 overflow-auto py-2">
          {user && (
            <div className="story-item">
              <div className="story-tile d-flex flex-column align-items-center">
                {user.avatarUrl ? <img src={user.avatarUrl} className="story-avatar avatar" /> : <div className="story-avatar avatar" />}
                <button className="btn btn-ghost mt-2 story-open-btn" onClick={() => openStoryOrCreate(0)}>
                  Tu Historia
                </button>
                <form onSubmit={submitStory} className="w-100 mt-2 story-create-form">
                  <input className="form-control mb-2" placeholder="Image URL" value={newStoryMedia} onChange={(e) => setNewStoryMedia(e.target.value)} />
                  <input className="form-control mb-2" placeholder="Texto (opcional)" value={newStoryText} onChange={(e) => setNewStoryText(e.target.value)} />
                  <div>
                    <button className="btn btn-primary w-100" type="submit" disabled={creatingStory}>{creatingStory ? 'Publicando...' : 'Añadir'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {stories.map((s, idx) => (
            <div key={s.id} className="story-item text-center">
              <button className={`story-btn story-tile ${s.id < 0 ? 'story-pending' : ''}`} onClick={() => openStoryByIndex(idx)} type="button">
                {s.author?.avatarUrl ? <img src={s.author.avatarUrl} className="story-avatar avatar" /> : <div className="story-avatar avatar" />}
                {s.id < 0 && <div className="story-pulse" />}
                <div className="story-label"><UserBadge user={s.author} size={12} showName={true} /></div>
              </button>
            </div>
          ))}
        </div>
      </section>
      <h1>Feed</h1>
      {user && (
        <div className="card p-3">
          <form onSubmit={submitPost}>
            <textarea className="form-control" value={newPostText} onChange={(e) => setNewPostText(e.target.value)} placeholder="¿Qué estás pensando?" />
            <div className="d-flex gap-2 mt-2">
              <button className="btn btn-primary" type="submit" disabled={creatingPost}>{creatingPost ? 'Publicando...' : 'Publicar'}</button>
            </div>
          </form>
        </div>
      )}
      {posts.map((p) => (
        <article key={p.id} className="post-card" onClick={() => { /* keeping click inert to avoid accidental navigation */ }}>
          {/* top-right menu */}
          <div className="post-menu">
            {user && user.id === p.author.id && (
              <div style={{ position: 'relative' }}>
                <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); setOpenPostMenuId(openPostMenuId === p.id ? null : p.id); }} type="button" aria-haspopup="true" aria-expanded={openPostMenuId === p.id}>⋯</button>
                {openPostMenuId === p.id && (
                  <div className="post-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-ghost" onClick={() => { setOpenPostMenuId(null); setEditingPostId(p.id); setEditingPostText(p.content); }} type="button" aria-label="Editar publicación">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4l9 9"/><path d="M21 7l-9 9"/><path d="M7 20H4v-3"/></svg>
                      <span>Editar</span>
                    </button>
                    <button className="btn btn-ghost" onClick={() => { setOpenPostMenuId(null); deletePost(p.id); }} type="button" aria-label="Eliminar publicación">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      <span>Eliminar</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="post-header">
            <div className="d-flex align-items-center" style={{ flex: '1 1 auto', minWidth: 0 }}>
              <UserBadge user={p.author} size={44} link showName={true} />
            </div>
            <div className="post-meta ms-3" style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>{formatStable(p.createdAt)}</div>
          </div>
          <div className="post-body">{editingPostId === p.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea value={editingPostText} onChange={(e) => setEditingPostText(e.target.value)} style={{ width: '100%', minHeight: 120, padding: 8, borderRadius: 8 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); savePostEdit(p.id); }} disabled={savingPostEdit}>{savingPostEdit ? 'Guardando...' : 'Guardar'}</button>
                <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); setEditingPostId(null); setEditingPostText(''); }} type="button">Cancelar</button>
              </div>
            </div>
          ) : p.content}</div>
          <div className="post-actions">
            <button
              className={`btn btn-ghost btn-like-anim ${likedMap[p.id] ? 'btn-liked' : ''}`}
              onClick={(e) => toggleLike(e, p.id)}
              aria-pressed={!!likedMap[p.id]}
              aria-label={likedMap[p.id] ? 'Desmarcar' : 'Marcar'}
            >
              {likedMap[p.id] ? (
                // full moon when liked
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="12" cy="12" r="8" />
                </svg>
              ) : (
                // crescent when not liked
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
              <small className="muted">{p._count?.likes || 0}</small>
            </button>
            <button className="btn btn-ghost" onClick={(e) => toggleComments(e, p.id)}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>{p._count?.comments || 0} Comentarios</span>
            </button>
            <button className="btn btn-ghost" onClick={(e) => sharePost(e, p.id)}>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M4 12v7a1 1 0 0 0 1.6.8L12 17l6.4 2.8A1 1 0 0 0 20 19v-7"/>
              </svg>
              <span>Compartir</span>
            </button>
            <Link href={`/posts/${p.id}`} className="btn btn-ghost" style={{ marginLeft: 'auto' }}>Ver</Link>
          </div>
          {commentOpen[p.id] && (
            <div style={{ marginTop: 8 }}>
              <form onSubmit={(e) => submitComment(e, p.id)}>
                <textarea value={commentText[p.id] || ''} onChange={(e) => setCommentText((s) => ({ ...s, [p.id]: e.target.value }))} placeholder="Escribe un comentario..." disabled={!!pendingComments[p.id]} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-primary" type="submit" disabled={!!pendingComments[p.id]}>
                    {pendingComments[p.id] ? (
                      <>
                        <svg style={{ width: 14, height: 14, marginRight: 8 }} viewBox="0 0 50 50">
                          <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="5" fill="none" strokeDasharray="31.4 31.4">
                          </circle>
                        </svg>
                        Enviando...
                      </>
                    ) : 'Enviar'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setCommentOpen((s) => ({ ...s, [p.id]: false }))} disabled={!!pendingComments[p.id]}>Cancelar</button>
                </div>
              </form>
              <div style={{ marginTop: 12 }}>
                {(commentsMap[p.id] || []).map((c) => (
                  <div key={c.id} className="comment">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <UserBadge user={c.author} size={28} showName={true} />
                      <div style={{ marginLeft: 8 }}>
                        <div><span className="muted">{formatStable(c.createdAt)}</span></div>
                        <div>{c.content}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>
      ))}

      {/* Story viewer modal */}
      {viewingStory && viewingIndex !== null && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setViewingStory(null); setViewingIndex(null); }}>
          <div className="modal" style={{ background: '#fff', padding: 16, borderRadius: 8, maxWidth: 720, width: '90%' }} onClick={(e) => e.stopPropagation()} onMouseEnter={() => setViewingPaused(true)} onMouseLeave={() => setViewingPaused(false)}>
            <div style={{ display: 'flex', gap: 12 }}>
              {viewingStory.mediaUrl ? <img src={viewingStory.mediaUrl} style={{ maxWidth: 320, maxHeight: 480, objectFit: 'cover', borderRadius: 6 }} /> : null}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {viewingStory.author?.avatarUrl ? <img src={viewingStory.author.avatarUrl} style={{ width: 44, height: 44, borderRadius: '50%' }} /> : <div className="avatar" style={{ width: 44, height: 44 }} />}
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <strong>{viewingStory.author?.username || 'Anon'}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>{formatStable(viewingStory.createdAt)}</div>
                    </div>
                    <div style={{ marginTop: 8, height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 6, overflow: 'hidden' }}>
                      <div className="story-progress" style={{ width: isClient ? `${Math.min(100, Math.max(0, ((Date.now() - new Date(viewingStory.createdAt).getTime()) % 5000) / 50))}%` : '0%' }} />
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>{viewingStory.text}</div>
                <div style={{ marginTop: 12 }}>
                  {user && user.id === viewingStory.userId && (
                    <button className="btn btn-danger" onClick={() => setConfirmDeleteStoryId(viewingStory.id)}>Eliminar</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {page > 1 && <a className="btn btn-ghost" href={`/?page=${page - 1}`}>Prev</a>}
        {(!totalPages || page < totalPages) && <a className="btn btn-ghost" href={`/?page=${page + 1}`}>Next</a>}
        {totalPages && <div style={{ marginLeft: 'auto' }}>Página {page} de {totalPages}</div>}
      </div>
      {/* Confirm delete post modal */}
      <ConfirmModal open={!!confirmDeletePostId} title="Eliminar publicación" description="¿Estás seguro de que deseas eliminar esta publicación? Esta acción no se puede deshacer." confirmLabel="Eliminar" cancelLabel="Cancelar" loading={confirmDeletingPost} onCancel={() => setConfirmDeletePostId(null)} onConfirm={() => performDeletePost()} />
      {/* Confirm delete story modal */}
      <ConfirmModal open={!!confirmDeleteStoryId} title="Eliminar historia" description="¿Estás seguro de que deseas eliminar esta historia? Esta acción no se puede deshacer." confirmLabel="Eliminar" cancelLabel="Cancelar" loading={confirmDeletingStory} onCancel={() => setConfirmDeleteStoryId(null)} onConfirm={() => performDeleteStory()} />
    </main>
  );
}

export async function getServerSideProps(context: any) {
  const api = process.env.NEXT_PUBLIC_API_URL || 'https://trohm-production.up.railway.app';
  const page = Number(context.query.page || 1);
  const limit = 10;
  try {
    const res = await axios.get(`${api}/api/posts?page=${page}&limit=${limit}`);
    const total = Number(res.headers['x-total-count'] || res.data.length);
    return { props: { posts: res.data, page, total } };
  } catch (err) {
    return { props: { posts: [], page: 1 } };
  }
}
