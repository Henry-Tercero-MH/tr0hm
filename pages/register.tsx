import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

const PASSWORD_RULES = [
  { key: 'length', label: 'Al menos 8 caracteres', test: (v: string) => v.length >= 8 },
  { key: 'lower', label: 'Letras minúsculas', test: (v: string) => /[a-z]/.test(v) },
  { key: 'upper', label: 'Letras mayúsculas', test: (v: string) => /[A-Z]/.test(v) },
  { key: 'number', label: 'Números (0-9)', test: (v: string) => /[0-9]/.test(v) },
  { key: 'special', label: 'Caracter especial (ej. !@#$%)', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ username: false, email: false, password: false });
  const router = useRouter();
  const { login } = useAuth();

  useEffect(() => {
    // small accessibility improvement: focus first input on mount
    const el = document.querySelector('input[placeholder="username"]') as HTMLInputElement | null;
    if (el) el.focus();
  }, []);

  function passwordValidity() {
    const res: Record<string, boolean> = {};
    for (const r of PASSWORD_RULES) res[r.key] = r.test(password);
    return res;
  }

  function allValid() {
    const v = passwordValidity();
    return Object.values(v).every(Boolean) && username.trim().length > 2 && /@/.test(email);
  }

  async function submit(e: any) {
    e.preventDefault();
    setTouched({ username: true, email: true, password: true });
    setError(null);
    if (!allValid()) {
      setError('Por favor, corrige los campos marcados antes de continuar.');
      return;
    }
    setLoading(true);
    try {
      const api = process.env.NEXT_PUBLIC_API_URL || 'https://trohm-production.up.railway.app';
      await axios.post(`${api}/api/auth/register`, { username, email, password }, { withCredentials: true });
      // auto-login after register
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const validity = passwordValidity();
  const metCount = Object.values(validity).filter(Boolean).length;
  const strength = Math.round((metCount / PASSWORD_RULES.length) * 100);
  const strengthLabel = strength < 40 ? 'Débil' : strength < 80 ? 'Media' : 'Fuerte';

  return (
    <main className="container my-4">
      <div className="card register-shell p-4">
        <h2>Crear cuenta</h2>
        {error && <div className="text-danger mb-2">{error}</div>}
        <form onSubmit={submit} className="register-form">
          <div className="mb-3">
            <label className="form-label">Usuario</label>
            <input className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username"
              onBlur={() => setTouched((s) => ({ ...s, username: true }))}
              aria-invalid={touched.username && username.trim().length < 3}
            />
            {touched.username && username.trim().length < 3 && (
              <div className="text-danger small">El usuario debe tener al menos 3 caracteres</div>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label">Email</label>
            <input className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email"
              onBlur={() => setTouched((s) => ({ ...s, email: true }))}
              aria-invalid={touched.email && !/@/.test(email)}
            />
            {touched.email && !/@/.test(email) && (
              <div className="text-danger small">Introduce un email válido</div>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label">Contraseña</label>
            <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password"
              onBlur={() => setTouched((s) => ({ ...s, password: true }))}
              aria-invalid={touched.password && !allValid()}
            />

            <div className="password-strength-wrapper mt-2">
              <div className="password-strength" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={strength}>
                <div className={`fill ${strength < 40 ? 'low' : strength < 80 ? 'mid' : 'high'}`} style={{ width: `${strength}%` }} />
              </div>
              <div className="strength-label">Seguridad: {strengthLabel}</div>
            </div>

            <div className="password-criteria mt-2" aria-live="polite">
              {PASSWORD_RULES.map((r) => (
                <div key={r.key} className={`criteria ${validity[r.key] ? 'met' : 'unmet'}`}>
                  <span className="icon" aria-hidden>
                    {validity[r.key] ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.18" />
                        <path d="M7 13l3 3 7-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" fill="none" opacity="0.28" />
                      </svg>
                    )}
                  </span>
                  <span className="label">{r.label}</span>
                </div>
              ))}
            </div>
            {touched.password && !allValid() && (
              <div className="text-muted small mt-1">
                La contraseña debe cumplir todas las condiciones anteriores.
              </div>
            )}
          </div>

          <div className="d-flex gap-2 align-items-center">
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear cuenta'}</button>
            <Link href="/login" className="btn btn-ghost">Volver a login</Link>
          </div>
        </form>
      </div>
    </main>
  );
}
