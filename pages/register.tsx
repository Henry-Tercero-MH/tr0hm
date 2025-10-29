import React, { useState } from 'react';
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

  async function submit(e: any) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
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
      <div className="card" style={{ maxWidth: 520, margin: '24px auto' }}>
        <h2>Crear cuenta</h2>
        {error && <div className="muted" style={{ color: 'var(--danger)' }}>{error}</div>}
        <form onSubmit={submit}>
          <label>Usuario</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
          <label>Contraseña</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear cuenta'}</button>
            <a className="btn btn-ghost" href="/login">Volver a login</a>
          </div>
        </form>
      </div>
    </main>
  );
}
