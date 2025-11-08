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

import { formatStable, formatCompact } from '../lib/formatDate';

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

  // URL detection and rendering helpers
  const cleanUrl = (url: string): string => {
    // Remove trailing punctuation that's not part of the URL
    return url.replace(/[.,;:!?)\]]+$/, '');
  };
  
  const isImageUrl = (url: string): boolean => {
    const cleanedUrl = cleanUrl(url);
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(cleanedUrl);
  };

  const isVideoUrl = (url: string): boolean => {
    const cleanedUrl = cleanUrl(url);
    return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(cleanedUrl);
  };

  const getYouTubeVideoId = (url: string): string | null => {
    const cleanedUrl = cleanUrl(url);
    const match = cleanedUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  };

  const renderContent = (content: string) => {
    if (!content) return null;
    
    // Reset regex before use
    const urlPattern = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;
    const parts = content.split(urlPattern);
    const elements: React.ReactNode[] = [];
    const renderedUrls = new Set<string>();

    parts.forEach((part, index) => {
      const trimmedPart = part.trim();
      if (!trimmedPart) return;
      
      // Check if this part is a URL
      if (trimmedPart.startsWith('http://') || trimmedPart.startsWith('https://')) {
        const url = cleanUrl(trimmedPart);
        
        // Check if we've already rendered this URL
        if (renderedUrls.has(url)) {
          return; // Skip duplicate URLs
        }
        
        renderedUrls.add(url);
        
        console.log('Processing URL:', url, 'isImage:', isImageUrl(url));
        
        // Check what type of URL it is and render preview
        if (isImageUrl(url)) {
          elements.push(
            <div key={`img-${index}`} className="post-media" style={{ marginTop: 12 }}>
              <img 
                src={url} 
                alt="Imagen compartida" 
                style={{ 
                  width: '100%', 
                  maxHeight: 500, 
                  objectFit: 'contain', 
                  borderRadius: 8,
                  display: 'block',
                  background: 'var(--bg)'
                }}
                loading="lazy"
                onError={(e) => {
                  console.error('Error loading image:', url);
                  const target = e.currentTarget;
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="post-link" style="display: block; padding: 12px; text-align: center; color: var(--primary);">🖼️ Error al cargar imagen: ${url}</a>`;
                  }
                }}
                onLoad={() => console.log('Image loaded successfully:', url)}
              />
            </div>
          );
        } else if (isVideoUrl(url)) {
          console.log('Rendering video:', url);
          elements.push(
            <div key={`video-${index}`} className="post-media" style={{ marginTop: 12 }}>
              <video 
                controls 
                style={{ 
                  width: '100%', 
                  maxHeight: 500, 
                  borderRadius: 8,
                  display: 'block',
                  background: '#000'
                }}
                preload="metadata"
              >
                <source src={url} type={url.endsWith('.mp4') ? 'video/mp4' : url.endsWith('.webm') ? 'video/webm' : 'video/ogg'} />
                Tu navegador no soporta videos HTML5.
              </video>
            </div>
          );
        } else {
          const youtubeId = getYouTubeVideoId(url);
          if (youtubeId) {
            console.log('Rendering YouTube:', youtubeId);
            elements.push(
              <div key={`yt-${index}`} className="post-media" style={{ marginTop: 12, position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 8 }}>
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    borderRadius: 8
                  }}
                  title="Video de YouTube"
                />
              </div>
            );
          } else {
            // Generic link preview - show as clickable card
            elements.push(
              <div key={`link-${index}`} className="post-link-preview" style={{ marginTop: 12 }}>
                <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  <div style={{ 
                    padding: 12, 
                    border: '1px solid var(--glass-border)', 
                    borderRadius: 8, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 12,
                    background: 'var(--bg)',
                    transition: 'all 0.2s ease'
                  }}
                  className="link-preview-card"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {new URL(url).hostname}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {url}
                      </div>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                </a>
              </div>
            );
          }
        }
      } else {
        // It's regular text
        elements.push(<span key={`text-${index}`}>{part}</span>);
      }
    });

    return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{elements}</div>;
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
    if (!user) {
      toast.show('Debes iniciar sesión para crear historias', 'error');
      return;
    }
    
    const mediaUrl = newStoryMedia.trim();
    if (!mediaUrl) {
      toast.show('Debes agregar una URL de imagen', 'error');
      return;
    }
    
    // Basic URL validation
    try {
      new URL(mediaUrl);
    } catch {
      toast.show('La URL de la imagen no es válida', 'error');
      return;
    }
    
    setCreatingStory(true);
    const optimistic: Story = {
      id: -Date.now() as unknown as number,
      userId: user.id as number,
      author: { id: user.id as number, username: user.username as string, avatarUrl: (user as any).avatarUrl },
      mediaUrl: mediaUrl,
      text: newStoryText.trim() || null,
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
      toast.show('Historia creada exitosamente', 'success');
    } catch (err) {
      console.error('create story', err);
      // rollback
      setStories((s) => s.filter((x) => x.id !== optimistic.id));
      toast.show('No se pudo crear la historia. Intenta de nuevo.', 'error');
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
              <div className="story-tile d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => setShowCreateModal(true)}>
                <div style={{ position: 'relative', width: 64, height: 64 }}>
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} className="story-avatar avatar" style={{ filter: 'brightness(0.8)' }} />
                  ) : (
                    <div className="story-avatar avatar" style={{ background: 'var(--primary)', opacity: 0.8 }} />
                  )}
                  <div style={{ 
                    position: 'absolute', 
                    bottom: -4, 
                    right: -4, 
                    width: 28, 
                    height: 28, 
                    borderRadius: '50%', 
                    background: 'var(--primary)', 
                    border: '3px solid var(--card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: 18,
                    fontWeight: 'bold',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}>
                    +
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>
                  Crear
                </div>
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
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16, marginTop: 24 }}>Feed</h1>
      {user && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <form onSubmit={submitPost}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} alt={user.username} />
              ) : (
                <div className="avatar" style={{ width: 48, height: 48, flexShrink: 0 }} />
              )}
              <textarea 
                className="form-control" 
                value={newPostText} 
                onChange={(e) => setNewPostText(e.target.value)} 
                placeholder="¿Qué estás pensando?" 
                rows={3}
                style={{ 
                  flex: 1, 
                  resize: 'vertical', 
                  minHeight: 60,
                  fontSize: 15
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  style={{ padding: '8px 12px', gap: 6 }}
                  title="Pega una URL para compartir imágenes, videos o enlaces"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span style={{ fontSize: 14 }}>Imagen/Video</span>
                </button>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Puedes pegar URLs de imágenes, videos o enlaces
                </span>
              </div>
              <button 
                className="btn btn-primary" 
                type="submit" 
                disabled={creatingPost || !newPostText.trim()}
                style={{ minWidth: 100 }}
              >
                {creatingPost ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Publicando...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Publicar
                  </>
                )}
              </button>
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
          <div className="post-body">
            {editingPostId === p.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea value={editingPostText} onChange={(e) => setEditingPostText(e.target.value)} style={{ width: '100%', minHeight: 120, padding: 8, borderRadius: 8 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); savePostEdit(p.id); }} disabled={savingPostEdit}>{savingPostEdit ? 'Guardando...' : 'Guardar'}</button>
                  <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); setEditingPostId(null); setEditingPostText(''); }} type="button">Cancelar</button>
                </div>
              </div>
            ) : (
              renderContent(p.content)
            )}
          </div>
          <div className="post-actions">
            <button
              className={`btn btn-ghost btn-like-anim ${likedMap[p.id] ? 'btn-liked' : ''}`}
              onClick={(e) => toggleLike(e, p.id)}
              aria-pressed={!!likedMap[p.id]}
              aria-label={likedMap[p.id] ? 'Desmarcar' : 'Marcar'}
              style={{gap: '6px'}}
            >
              {likedMap[p.id] ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              )}
              <small className="muted">{p._count?.likes || 0}</small>
            </button>
            <button className="btn btn-ghost" onClick={(e) => toggleComments(e, p.id)} style={{gap: '6px'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span>{p._count?.comments || 0}</span>
            </button>
            <button className="btn btn-ghost" onClick={(e) => sharePost(e, p.id)} style={{gap: '6px'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
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
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <UserBadge user={c.author} size={32} showName={false} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <strong style={{ fontSize: '14px' }}>{c.author.username}</strong>
                          <span className="muted" style={{ fontSize: '11px' }}>·</span>
                          <span className="muted" style={{ fontSize: '11px' }}>{formatCompact(c.createdAt)}</span>
                        </div>
                        <div style={{ fontSize: '14px', lineHeight: '1.4' }}>{c.content}</div>
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
        <div 
          className="modal-overlay" 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.85)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            zIndex: 1060
          }} 
          onClick={() => { setViewingStory(null); setViewingIndex(null); }}
        >
          <div 
            className="card" 
            style={{ 
              padding: 20, 
              borderRadius: 12, 
              maxWidth: 800, 
              width: '95%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }} 
            onClick={(e) => e.stopPropagation()} 
            onMouseEnter={() => setViewingPaused(true)} 
            onMouseLeave={() => setViewingPaused(false)}
          >
            {/* Header with author info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {viewingStory.author?.avatarUrl ? (
                  <img src={viewingStory.author.avatarUrl} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} alt={viewingStory.author.username} />
                ) : (
                  <div className="avatar" style={{ width: 48, height: 48 }} />
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{viewingStory.author?.username || 'Anónimo'}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{formatCompact(viewingStory.createdAt)}</div>
                </div>
              </div>
              <button 
                className="btn btn-ghost" 
                onClick={() => { setViewingStory(null); setViewingIndex(null); }}
                aria-label="Cerrar"
                style={{ width: 36, height: 36, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: 16, height: 4, background: 'rgba(0,0,0,0.1)', borderRadius: 4, overflow: 'hidden' }}>
              <div 
                className="story-progress" 
                style={{ 
                  width: isClient ? `${Math.min(100, Math.max(0, ((Date.now() - new Date(viewingStory.createdAt).getTime()) % 5000) / 50))}%` : '0%',
                  height: '100%',
                  background: 'var(--primary)',
                  transition: 'width 0.3s ease'
                }} 
              />
            </div>

            {/* Media and content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {viewingStory.mediaUrl && (
                <div style={{ borderRadius: 8, overflow: 'hidden', maxHeight: 500 }}>
                  <img 
                    src={viewingStory.mediaUrl} 
                    style={{ width: '100%', height: 'auto', maxHeight: 500, objectFit: 'contain', display: 'block' }} 
                    alt="Historia"
                  />
                </div>
              )}
              
              {viewingStory.text && (
                <div style={{ fontSize: 15, lineHeight: 1.5, padding: '12px 0' }}>
                  {viewingStory.text}
                </div>
              )}
              
              {/* Actions */}
              {user && user.id === viewingStory.userId && (
                <div style={{ paddingTop: 12, borderTop: '1px solid var(--glass-border)' }}>
                  <button 
                    className="btn btn-danger" 
                    onClick={() => setConfirmDeleteStoryId(viewingStory.id)}
                    style={{ gap: 8 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                    Eliminar Historia
                  </button>
                </div>
              )}

              {/* Navigation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                <button 
                  className="btn btn-ghost" 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (viewingIndex > 0) {
                      const prevIdx = viewingIndex - 1;
                      setViewingIndex(prevIdx);
                      setViewingStory(stories[prevIdx]);
                    }
                  }}
                  disabled={viewingIndex === 0}
                  style={{ gap: 6 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                  Anterior
                </button>
                <span className="muted" style={{ fontSize: 13 }}>
                  {viewingIndex + 1} / {stories.length}
                </span>
                <button 
                  className="btn btn-ghost" 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (viewingIndex < stories.length - 1) {
                      const nextIdx = viewingIndex + 1;
                      setViewingIndex(nextIdx);
                      setViewingStory(stories[nextIdx]);
                    }
                  }}
                  disabled={viewingIndex === stories.length - 1}
                  style={{ gap: 6 }}
                >
                  Siguiente
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
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
      
      {/* Create Story modal for mobile */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }} onClick={() => setShowCreateModal(false)}>
          <div className="card" style={{ padding: 24, borderRadius: 12, maxWidth: 480, width: '92%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Crear Historia</h3>
              <button 
                className="btn btn-ghost" 
                onClick={() => setShowCreateModal(false)} 
                aria-label="Cerrar"
                style={{ width: 36, height: 36, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <form onSubmit={submitStory}>
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="story-media" style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>
                  URL de Imagen <span style={{ color: 'var(--danger)', marginLeft: 4 }}>*</span>
                </label>
                <input 
                  id="story-media"
                  className="form-control" 
                  placeholder="https://ejemplo.com/imagen.jpg" 
                  value={newStoryMedia} 
                  onChange={(e) => setNewStoryMedia(e.target.value)}
                  required
                  style={{ fontSize: 14 }}
                />
                {newStoryMedia && (
                  <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                    <img 
                      src={newStoryMedia} 
                      alt="Preview" 
                      style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="story-text" style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>
                  Texto (opcional)
                </label>
                <textarea 
                  id="story-text"
                  className="form-control" 
                  placeholder="Escribe algo sobre tu historia..." 
                  value={newStoryText} 
                  onChange={(e) => setNewStoryText(e.target.value)}
                  rows={3}
                  maxLength={200}
                  style={{ fontSize: 14, resize: 'vertical' }}
                />
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, textAlign: 'right' }}>
                  {newStoryText.length}/200
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  className="btn btn-ghost" 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button 
                  className="btn btn-primary" 
                  type="submit" 
                  disabled={creatingStory || !newStoryMedia.trim()}
                  style={{ flex: 1 }}
                >
                  {creatingStory ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Publicando...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 6 }}>
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Publicar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
