import '../styles.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { NotificationsProvider } from '../context/NotificationsContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import NotificationsDropdown from '../components/NotificationsDropdown';
import { useEffect, useState, useRef } from 'react';
import getDayTheme from '../lib/dayTheme';
import api from '../lib/api';
import { useRouter } from 'next/router';

function decodeToken(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(payload)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function Header() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState<string>('dark');
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e5e7eb'/><text x='50' y='55' font-size='40' text-anchor='middle' fill='%239ca3af'>?</text></svg>";

  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme');
      const apply = (t: string) => {
        setTheme(t);
        document.documentElement.setAttribute('data-theme', t);
      };

      // If user chose 'system' we apply a time-of-day theme computed locally.
      const applySystemTime = () => {
        try {
          const d = getDayTheme();
          apply(d.mode);
          // apply returned css vars
          Object.entries(d.vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
        } catch (err) {
          // fallback to light
          apply('light');
        }
      };

      if (saved === 'light' || saved === 'dark') {
        apply(saved);
      } else if (saved === 'system') {
        applySystemTime();
      } else {
        // default: system-time driven behavior
        applySystemTime();
      }

      // No global listeners required for time-driven behavior. If you want to
      // react to OS-level color scheme changes too, we could wire matchMedia
      // here, but 'system' now means "follow local time of day".
      return () => {
        /* nothing to cleanup here */
      };
    } catch (e) {
      // ignore
    }
  }, []);

  function toggleTheme() {
    // simple toggle still supported (cycles dark -> light -> system)
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    applyChoice(next);
  }

  function applyChoice(choice: string) {
    try {
      if (choice === 'system') {
        localStorage.setItem('theme', 'system');
        // start dynamic system-time driven theme updates
        const d = getDayTheme();
        setTheme(d.mode);
        document.documentElement.setAttribute('data-theme', d.mode);
        Object.entries(d.vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
        // start an interval to update every 5 minutes
        if ((window as any).__trohmSystemThemeInterval) {
          clearInterval((window as any).__trohmSystemThemeInterval);
        }
        (window as any).__trohmSystemThemeInterval = setInterval(() => {
          const cur = getDayTheme();
          setTheme(cur.mode);
          document.documentElement.setAttribute('data-theme', cur.mode);
          Object.entries(cur.vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
        }, 5 * 60 * 1000);
      } else if (choice === 'light' || choice === 'dark') {
        localStorage.setItem('theme', choice);
        setTheme(choice);
        document.documentElement.setAttribute('data-theme', choice);
        // clear any running system interval
        if ((window as any).__trohmSystemThemeInterval) {
          clearInterval((window as any).__trohmSystemThemeInterval);
          (window as any).__trohmSystemThemeInterval = null;
        }
      }
    } catch (e) {
      // ignore
    }
    setShowThemeMenu(false);
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      // ignore clicks on the hamburger itself to avoid opening then immediately closing
      if (hamburgerRef.current && hamburgerRef.current.contains(target)) return;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setShowThemeMenu(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(target)) {
        setShowMobileMenu(false);
      }
    }
    if (showThemeMenu || showMobileMenu) document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [showThemeMenu, showMobileMenu]);

  // prevent background scroll when mobile menu is open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    if (showMobileMenu) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = prev || '';
    }
    return () => { document.body.style.overflow = prev || ''; };
  }, [showMobileMenu]);

  return (
    <header className="site-header">
      <div className="brand">
        <div className="logo">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <defs>
              <linearGradient id="g1" x1="0" x2="1">
                <stop offset="0%" stopColor="#9b5cff" />
                <stop offset="100%" stopColor="#00f0ff" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="24" height="24" rx="5" fill="url(#g1)" opacity="0.95" />
            <path d="M6 16L10 8L14 16H18" stroke="#051020" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            {/* small moon badge in the top-right of the logo */}
            <g transform="translate(0,0)">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="#fff" opacity="0.92" transform="translate(-6,-6) scale(0.42)" />
            </g>
          </svg>
        </div>
  <h1>Tr0hm</h1>
      </div>

      <div className="nav-links">
        {/* Hamburger for small screens */}
        <button
          ref={hamburgerRef}
          className="hamburger"
          aria-label={showMobileMenu ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setShowMobileMenu((s) => !s)}
          aria-expanded={showMobileMenu}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            {showMobileMenu ? (
              <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button aria-label="Cambiar tema" className="theme-toggle" onClick={() => setShowThemeMenu((s) => !s)} title="Cambiar tema">
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="3" fill="currentColor" />
              </svg>
            )}
          </button>

            {showThemeMenu && (
              <div ref={menuRef} className="theme-menu" role="menu" aria-label="Opciones de tema">
                <button role="menuitem" onClick={() => applyChoice('light')} className="theme-menu-item">Light</button>
                <button role="menuitem" onClick={() => applyChoice('dark')} className="theme-menu-item">Dark</button>
                <button role="menuitem" onClick={() => applyChoice('system')} className="theme-menu-item">System</button>
              </div>
            )}
        </div>
        <a href="/">Feed</a>
        <a href="/users">Usuarios</a>
        <a href="/messages">Mensajes</a>
        {!user && <a href="/login">Login</a>}
        {user && (
          <>
            <a href={`/users/${user.id}`} style={{ display: 'flex', gap: 8, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }} alt={`${user.username} avatar`} className="avatar" style={{ width: 28, height: 28, objectFit: 'cover' }} />
              ) : (
                <div className="avatar" style={{ width: 28, height: 28 }} />
              )}
              <span className="muted">{user.username}</span>
            </a>
            <button className="btn btn-ghost" onClick={logout}>Logout</button>
          </>
        )}
        <NotificationsDropdown />
        {/* Mobile nav overlay */}
        {showMobileMenu && (
          <div className="mobile-drawer" role="dialog" aria-modal="true">
            <div className="mobile-drawer-backdrop" onClick={() => setShowMobileMenu(false)} />
            <div ref={mobileMenuRef} className="mobile-drawer-panel">
              {/* Theme choices for mobile */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Tema</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" onClick={() => { applyChoice('light'); setShowMobileMenu(false); }}>Light</button>
                  <button className="btn btn-ghost" onClick={() => { applyChoice('dark'); setShowMobileMenu(false); }}>Dark</button>
                  <button className="btn btn-ghost" onClick={() => { applyChoice('system'); setShowMobileMenu(false); }}>System</button>
                </div>
              </div>

              <nav className="mobile-nav" role="menu" aria-label="Menu principal">
                <a href="/">Feed</a>
                <a href="/users">Usuarios</a>
                <a href="/messages">Mensajes</a>
                {!user && <a href="/login">Login</a>}
                {user && (
                  <>
                    <a href={`/users/${user.id}`}>Mi perfil</a>
                    <button className="btn btn-ghost" onClick={() => { setShowMobileMenu(false); logout(); }}>Logout</button>
                  </>
                )}
              </nav>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <ToastProvider>
          <Head>
            <title>Tr0hm</title>
            <meta name="description" content="Tr0hm — Comunidad" />
            <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          </Head>
          <Header />
          <Component {...pageProps} />
        </ToastProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}

export default MyApp;
