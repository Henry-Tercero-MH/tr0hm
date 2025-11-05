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

  if (status === 'none') {
    return (
      <button className={`btn ${compact ? 'btn-sm' : ''} btn-primary`} onClick={sendRequest} disabled={loading}>
        Solicitar
      </button>
    );
  }
  if (status === 'requested') {
    return (
      <div className={`d-inline-flex align-items-center ${compact ? '' : 'gap-2'}`}>
        <button className={`btn ${compact ? 'btn-sm' : ''} btn-outline-primary`} disabled>Enviado</button>
        <button className={`btn ${compact ? 'btn-sm' : ''} btn-outline-secondary`} onClick={cancelRequest} disabled={loading}>Cancelar</button>
      </div>
    );
  }
  return (
    <div className={`d-inline-flex align-items-center ${compact ? '' : 'gap-2'}`}>
      <button className={`btn ${compact ? 'btn-sm' : ''} btn-outline-success`} disabled>Siguiendo</button>
      <button className={`btn ${compact ? 'btn-sm' : ''} btn-outline-danger`} onClick={unfollow} disabled={loading}>Dejar de seguir</button>
    </div>
  );
}
