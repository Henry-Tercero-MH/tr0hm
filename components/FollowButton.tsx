import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function FollowButton({ userId, compact = false }: { userId: number; compact?: boolean }) {
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<'none' | 'requested' | 'following'>('none');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function fetchStatus() {
      if (!user || !userId) return;
      try {
        setLoading(true);
        const r = await api.get(`/api/users/${userId}/follow-status`);
        if (!mounted) return;
        const s = r.data?.status as 'none' | 'requested' | 'following' | undefined;
        setStatus(s === 'requested' || s === 'following' ? s : 'none');
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchStatus();
    return () => { mounted = false; };
  }, [userId, user]);

  const sendRequest = async () => {
    if (!user) return alert('Debes iniciar sesión');
    try {
      setLoading(true);
      await api.post(`/api/users/${userId}/request`);
      setStatus('requested');
      toast.show('Solicitud enviada', 'success');
    } catch (e) {
      console.error('send request', e);
      toast.show('No se pudo enviar la solicitud', 'error');
    } finally { setLoading(false); }
  };

  const cancelRequest = async () => {
    if (!user) return alert('Debes iniciar sesión');
    try {
      setLoading(true);
      await api.delete(`/api/users/${userId}/request`);
      setStatus('none');
      toast.show('Solicitud cancelada', 'success');
    } catch (e) {
      console.error('cancel request', e);
      toast.show('No se pudo cancelar', 'error');
    } finally { setLoading(false); }
  };

  const unfollow = async () => {
    if (!user) return alert('Debes iniciar sesión');
    try {
      setLoading(true);
      await api.delete(`/api/users/${userId}/follow`);
      setStatus('none');
      toast.show('Dejaste de seguir', 'success');
    } catch (e) {
      console.error('unfollow', e);
      toast.show('No se pudo dejar de seguir', 'error');
    } finally { setLoading(false); }
  };

  if (!user) return null;
  if (user.id === userId) return null;

  // Inline SVG icons for small buttons — keep accessible labels via visually-hidden
  const IconPersonPlus = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M15 14c2.761 0 5 2.239 5 5v1H4v-1c0-2.761 2.239-5 5-5h6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 10a4 4 0 108 0 4 4 0 00-8 0z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 8v4M21 10h-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const IconPaperPlane = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const IconCheck = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const IconPersonX = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M16 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 21v-1c0-2 2.686-3.5 6-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 16l4 4M22 16l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  if (status === 'none') {
    return (
      <button className={`btn ${compact ? 'btn-sm' : ''} btn-primary d-inline-flex align-items-center`} onClick={sendRequest} disabled={loading}>
        <span aria-hidden className="me-2">{IconPersonPlus}</span>
        <span className="visually-hidden">Solicitar</span>
        {!compact && <span>Solicitar</span>}
      </button>
    );
  }
  if (status === 'requested') {
    return (
      <div className={`d-inline-flex align-items-center ${compact ? '' : 'gap-2'}`}>
        <button className={`btn ${compact ? 'btn-sm' : ''} btn-outline-primary d-inline-flex align-items-center`} disabled aria-label="Solicitud enviada">
          <span aria-hidden className="me-1">{IconPaperPlane}</span>
          <span className="visually-hidden">Enviado</span>
          {!compact && <span>Enviado</span>}
        </button>
        <button className={`btn ${compact ? 'btn-sm' : ''} btn-outline-secondary d-inline-flex align-items-center`} onClick={cancelRequest} disabled={loading} aria-label="Cancelar solicitud">
          <span aria-hidden className="me-1">✖</span>
          <span className="visually-hidden">Cancelar</span>
          {!compact && <span>Cancelar</span>}
        </button>
      </div>
    );
  }
  return (
    <div className={`d-inline-flex align-items-center ${compact ? '' : 'gap-2'}`}>
      <button className={`btn ${compact ? 'btn-sm' : ''} btn-outline-success d-inline-flex align-items-center`} disabled aria-label="Siguiendo">
        <span aria-hidden className="me-1">{IconCheck}</span>
        <span className="visually-hidden">Siguiendo</span>
        {!compact && <span>Siguiendo</span>}
      </button>
      <button className={`btn ${compact ? 'btn-sm' : ''} btn-outline-danger d-inline-flex align-items-center`} onClick={unfollow} disabled={loading} aria-label="Dejar de seguir">
        <span aria-hidden className="me-1">{IconPersonX}</span>
        <span className="visually-hidden">Dejar de seguir</span>
        {!compact && <span>Dejar de seguir</span>}
      </button>
    </div>
  );
}
