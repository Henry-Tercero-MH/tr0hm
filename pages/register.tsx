import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { login } = useAuth();
  const [mountCount, setMountCount] = useState<number>(0);
  const [lastMountAt, setLastMountAt] = useState<string>('');

  useEffect(() => {
    try {
      const key = 'register:mountCount';
      const prev = Number(window.sessionStorage.getItem(key) || '0');
      const next = prev + 1;
      window.sessionStorage.setItem(key, String(next));
      setMountCount(next);
      setLastMountAt(new Date().toISOString());
      console.log('[register] mount', next);
      return () => console.log('[register] unmount');
    } catch (e) {
      // ignore
    }
  }, []);

  async function submit(e: any) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
  const api = process.env.NEXT_PUBLIC_API_URL || 'https://trohm-production.up.railway.app';
      await axios.post(`${api}/api/auth/register`, { username, email, password });
      // auto-login after register
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div style={{ position: 'fixed', right: 12, top: 80, zIndex: 9999, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: 8, borderRadius: 8, fontSize: 12 }}>
        <div><strong>Debug</strong></div>
        <div>mounts: {mountCount}</div>
        <div>last: {lastMountAt}</div>
        <div>path: {router.asPath}</div>
        <div>visibility: {typeof document !== 'undefined' ? document.visibilityState : 'na'}</div>
      </div>
      <div className="card" style={{ maxWidth: 520, margin: '24px auto' }}>
        <h2>Crear cuenta</h2>
        {error && <div className="muted" style={{ color: 'var(--danger)' }}>{error}</div>}
        <form onSubmit={submit}>
          <label>Usuario</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" 
            onFocus={() => console.log('register input focus username, disabled=', (document.querySelector('input[placeholder="username"]') as HTMLInputElement)?.disabled)}
            onKeyDown={(e) => console.log('username keydown', e.key)} />
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" 
            onFocus={() => console.log('register input focus email, disabled=', (document.querySelector('input[placeholder="email"]') as HTMLInputElement)?.disabled)}
            onKeyDown={(e) => console.log('email keydown', e.key)} />
          <label>Contraseña</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" 
            onFocus={() => console.log('register input focus password, disabled=', (document.querySelector('input[placeholder="password"]') as HTMLInputElement)?.disabled)}
            onKeyDown={(e) => console.log('password keydown', e.key)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear cuenta'}</button>
            <a className="btn btn-ghost" href="/login">Volver a login</a>
          </div>
        </form>
      </div>
    </main>
  );
}
