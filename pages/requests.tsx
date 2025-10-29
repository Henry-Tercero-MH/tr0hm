import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../lib/api';
import UserBadge from '../components/UserBadge';
import Link from 'next/link';
import { formatStable } from '../lib/formatDate';

type Req = { id: number; from: { id: number; username: string; avatarUrl?: string | null }; createdAt: string };

export default function RequestsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!user) return setLoading(false);
    setLoading(true);
    api.get('/api/requests').then((r) => {
      setRequests(r.data || []);
    }).catch((e) => {
      console.error('fetch requests', e);
      setRequests([]);
    }).finally(() => setLoading(false));
  }, [user]);

  const accept = async (id: number) => {
    setProcessing((s) => ({ ...s, [id]: true }));
    try {
      await api.post(`/api/requests/${id}/accept`);
      setRequests((r) => r.filter((x) => x.id !== id));
      toast.show('Solicitud aceptada', 'success');
    } catch (e) {
      console.error('accept', e);
      toast.show('No se pudo aceptar', 'error');
    } finally { setProcessing((s) => ({ ...s, [id]: false })); }
  };

  const reject = async (id: number) => {
    setProcessing((s) => ({ ...s, [id]: true }));
    try {
      await api.post(`/api/requests/${id}/reject`);
      setRequests((r) => r.filter((x) => x.id !== id));
      toast.show('Solicitud rechazada', 'success');
    } catch (e) {
      console.error('reject', e);
      toast.show('No se pudo rechazar', 'error');
    } finally { setProcessing((s) => ({ ...s, [id]: false })); }
  };

  if (!user) return (
    <main>
      <h1>Solicitudes</h1>
      <div className="card">Debes iniciar sesión para ver tus solicitudes. <Link href="/login">Iniciar sesión</Link></div>
    </main>
  );

  return (
    <main>
      <h1>Solicitudes entrantes</h1>
      <div className="card">
        {loading ? <div>Cargando...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requests.length === 0 && <div>No hay solicitudes pendientes</div>}
            {requests.map((r) => (
              <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <UserBadge user={r.from} size={44} link showName />
                  <div className="muted" style={{ fontSize: 12 }}>{formatStable(r.createdAt)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => accept(r.id)} disabled={!!processing[r.id]}>Aceptar</button>
                  <button className="btn btn-ghost" onClick={() => reject(r.id)} disabled={!!processing[r.id]}>Rechazar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
