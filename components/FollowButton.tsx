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

  // WhatsApp style icons - cleaner and more modern
  const IconPersonPlus = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="19" y1="8" x2="19" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="16" y1="11" x2="22" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
  const IconCheck = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const IconCheckDouble = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M18 6L9 15l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 6l-9 9-1.5-1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const IconX = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );

  if (status === 'none') {
    return (
      <button className={`btn ${compact ? 'btn-sm' : ''} btn-primary d-inline-flex align-items-center`} style={{gap: '6px'}} onClick={sendRequest} disabled={loading}>
        {IconPersonPlus}
        {!compact && <span>Seguir</span>}
      </button>
    );
  }
  if (status === 'requested') {
    return (
      <div className={`d-inline-flex align-items-center gap-2`}>
        <button className={`btn ${compact ? 'btn-sm' : ''} btn-ghost d-inline-flex align-items-center`} style={{gap: '6px'}} disabled aria-label="Solicitud enviada">
          {IconCheck}
          {!compact && <span>Enviado</span>}
        </button>
        <button className={`btn ${compact ? 'btn-sm' : ''} btn-ghost d-inline-flex align-items-center`} style={{gap: '4px'}} onClick={cancelRequest} disabled={loading} aria-label="Cancelar solicitud">
          {IconX}
          {!compact && <span>Cancelar</span>}
        </button>
      </div>
    );
  }
  return (
    <div className={`d-inline-flex align-items-center gap-2`}>
      <button className={`btn ${compact ? 'btn-sm' : ''} btn-ghost d-inline-flex align-items-center`} style={{gap: '6px'}} disabled aria-label="Siguiendo">
        {IconCheckDouble}
        {!compact && <span>Siguiendo</span>}
      </button>
      <button className={`btn ${compact ? 'btn-sm' : ''} btn-outline-secondary d-inline-flex align-items-center`} style={{gap: '4px'}} onClick={unfollow} disabled={loading} aria-label="Dejar de seguir">
        {IconX}
        {!compact && <span>Dejar</span>}
      </button>
    </div>
  );
}
