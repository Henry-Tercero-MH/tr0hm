import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { GetServerSideProps } from 'next';
import { formatStable } from '../../lib/formatDate';
import api from '../../lib/api';
import UserBadge from '../../components/UserBadge';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

type Post = { id: number; content: string; author: { id: number; username: string }; createdAt: string; _count?: { likes?: number; comments?: number } };

export default function PostPage({ post }: { post: Post | null }) {
  const { user } = useAuth();
  const [current, setCurrent] = useState<Post | null>(post);
  const [comments, setComments] = useState<any[]>([]);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const toast = useToast();

  useEffect(() => {
    (async () => {
      if (!current) return setLoading(false);
      try {
        const cRes = await api.get(`/api/posts/${current.id}/comments`);
        setComments(cRes.data || []);
      } catch (e) {
        setComments([]);
      }
      try {
        const likeRes = await api.get(`/api/posts/${current.id}/like`);
        setLiked(!!likeRes.data?.liked);
      } catch (e) {
        setLiked(false);
      }
      setLoading(false);
    })();
  }, [current]);

  if (!current) return <main><h1>Post no encontrado</h1></main>;

  const toggleLike = async () => {
    if (!user) {
      toast.show('Debes iniciar sesión para dar me gusta', 'info');
      return;
    }
    try {
      if (!liked) {
        await api.post(`/api/posts/${current.id}/like`);
        setLiked(true);
        setCurrent({ ...current, _count: { ...(current._count || {}), likes: (current._count?.likes || 0) + 1 } });
      } else {
        await api.delete(`/api/posts/${current.id}/like`);
        setLiked(false);
        setCurrent({ ...current, _count: { ...(current._count || {}), likes: Math.max(0, (current._count?.likes || 1) - 1) } });
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Error');
    }
  };

  const sharePost = async () => {
    if (!current) return;
    const url = `${window.location.origin}/posts/${current.id}`;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: 'Tr0hm', text: 'Mira esta publicación', url });
        toast.show('Compartido', 'success');
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        toast.show('Enlace copiado al portapapeles', 'success');
      } else {
        // eslint-disable-next-line no-alert
        window.prompt('Copia el enlace', url);
      }
    } catch (err) {
      console.error('share error', err);
      toast.show('No se pudo compartir', 'error');
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.show('Debes iniciar sesión para comentar', 'info');
      return;
    }
    if (!commentText) return;
    try {
      const res = await api.post(`/api/posts/${current.id}`, { content: commentText });
      setComments([...comments, res.data]);
      setCommentText('');
      setCurrent({ ...current, _count: { ...(current._count || {}), comments: (current._count?.comments || 0) + 1 } });
    } catch (err: any) {
      alert(err?.response?.data?.error || 'No se pudo comentar');
    }
  };

  return (
    <main>
      <article className="post-card">
        <div className="post-header">
          <UserBadge user={current.author as any} size={44} link showName={true} />
          <div style={{ marginLeft: 12 }} className="post-meta">{formatStable(current.createdAt)}</div>
        </div>
        <div className="post-body">{current.content}</div>
        <div className="post-actions">
          <button
            className={`btn btn-ghost btn-like-anim ${liked ? 'btn-liked' : ''}`}
            onClick={toggleLike}
            aria-pressed={!!liked}
            aria-label={liked ? 'Desmarcar' : 'Marcar'}
          >
            {liked ? (
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
            <small className="muted">{current._count?.likes || 0}</small>
          </button>
          <button className="btn btn-ghost" onClick={sharePost} style={{ marginLeft: 8 }}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M4 12v7a1 1 0 0 0 1.6.8L12 17l6.4 2.8A1 1 0 0 0 20 19v-7"/>
            </svg>
            <span>Compartir</span>
          </button>
          <span style={{ marginLeft: 8 }}>{current._count?.comments || 0} comentarios</span>
        </div>
        <section className="comments">
          <h4>Comentarios</h4>
          {loading ? <div>Cargando...</div> : (
            <div>
              {comments.map((c) => (
                <div key={c.id} className="comment">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <UserBadge user={c.author} size={28} showName={true} />
                    <div style={{ marginLeft: 8 }}>
                      <div className="muted">{formatStable(c.createdAt)}</div>
                      <div>{c.content}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={submitComment}>
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Escribe un comentario..." />
            <button type="submit">Comentar</button>
          </form>
        </section>
      </article>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { id } = ctx.params as any;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://trohm-production.up.railway.app';
  try {
    const res = await axios.get(`${apiUrl}/api/posts/${id}`);
    return { props: { post: res.data } };
  } catch (err) {
    return { props: { post: null } };
  }
};
