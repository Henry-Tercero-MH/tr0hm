import React, { useState } from 'react';
import axios from 'axios';
import { GetServerSideProps } from 'next';
import { formatStable } from '../../lib/formatDate';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import UserBadge from '../../components/UserBadge';
import { useToast } from '../../context/ToastContext';

type User = { id: number; username: string; bio?: string; avatarUrl?: string; createdAt?: string };

export default function UserProfile({ user }: { user: User | null }) {
  const { user: me, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ username: user?.username || '', bio: user?.bio || '', avatarUrl: user?.avatarUrl || '' });
  const [current, setCurrent] = useState<User | null>(user);
  const [errors, setErrors] = useState<{ username?: string; bio?: string; avatarUrl?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e5e7eb'/><text x='50' y='55' font-size='40' text-anchor='middle' fill='%239ca3af'>?</text></svg>";

  if (!current) return <main><h1>Usuario no encontrado</h1></main>;

  const isOwner = !!me && (me as any).id === current.id;

  const validate = () => {
    const errs: any = {};
    if (!form.username || form.username.trim().length < 3) errs.username = 'El nombre de usuario debe tener al menos 3 caracteres';
    if (form.bio && form.bio.length > 160) errs.bio = 'La bio no puede tener más de 160 caracteres';
    if (form.avatarUrl && !/^https?:\/\//i.test(form.avatarUrl)) errs.avatarUrl = 'La URL del avatar debe ser válida (http/https)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const toast = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await api.patch(`/api/users/${current.id}`, form);
      setCurrent(res.data);
      // if the logged-in user edited their own profile, update auth context so header updates
      if (me && (me as any).id === res.data.id) {
        try { updateUser(res.data); } catch (e) {}
      }
  setEditing(false);
  // show toast instead of text
  toast.show('Perfil actualizado correctamente', 'success');
    } catch (err: any) {
      setErrors({} as any);
      const msg = err?.response?.data?.error || 'No se pudo actualizar';
      setErrors({ username: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <UserBadge user={current} size={72} showName={true} />
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div>
            <div className="muted">Miembro desde: {formatStable(current.createdAt || '')}</div>
          </div>
        </div>
        <hr style={{ margin: '12px 0' }} />
        {!editing ? (
          <div>
            <div><strong>Bio</strong></div>
            <div style={{ marginBottom: 8 }}>{current.bio || 'Sin bio'}</div>
            {isOwner && <div><button onClick={() => { setEditing(true); }}>Editar perfil</button></div>}
          </div>
        ) : (
          <form onSubmit={submit}>
            <div>
              <label>Username</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              {errors.username && <div style={{ color: 'var(--danger)', marginTop: 6 }}>{errors.username}</div>}
            </div>
            <div>
              <label>Bio</label>
              <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              {errors.bio && <div style={{ color: 'var(--danger)', marginTop: 6 }}>{errors.bio}</div>}
            </div>
            <div>
              <label>Avatar URL</label>
              <input value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} />
              {errors.avatarUrl && <div style={{ color: 'var(--danger)', marginTop: 6 }}>{errors.avatarUrl}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setEditing(false); setErrors({}); }}>{'Cancelar'}</button>
            </div>
            
          </form>
        )}
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { id } = ctx.params as any;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  try {
    const res = await axios.get(`${apiUrl}/api/users/${id}`);
    return { props: { user: res.data } };
  } catch (err) {
    return { props: { user: null } };
  }
};
