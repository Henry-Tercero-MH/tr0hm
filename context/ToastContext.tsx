import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

type Toast = { id: string; type: 'info' | 'success' | 'error'; message: string; closing?: boolean; expiresAt?: number };

type ToastContextValue = {
  show: (message: string, type?: 'info' | 'success' | 'error', timeoutMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, { timeoutId?: any; expiresAt?: number; remaining?: number }>>(new Map());

  useEffect(() => {
    // cleanup on unmount
    return () => setToasts([]);
  }, []);

  const remove = (id: string) => {
    // clear any pending timer
    const entry = timers.current.get(id);
    if (entry?.timeoutId) {
      clearTimeout(entry.timeoutId);
      timers.current.delete(id);
    }
    // start closing animation
    setToasts((s) => s.map((x) => (x.id === id ? { ...x, closing: true } : x)));
    // remove after animation (200ms)
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 220);
  };

  const show = (message: string, type: 'info' | 'success' | 'error' = 'info', timeoutMs = 3500) => {
    const id = Math.random().toString(36).slice(2, 9);
    const expiresAt = Date.now() + timeoutMs;
    const t: Toast = { id, type, message, expiresAt };
    setToasts((s) => [...s, t]);
    const timeoutId = setTimeout(() => {
      remove(id);
    }, timeoutMs);
    timers.current.set(id, { timeoutId, expiresAt });
    return id;
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${t.type} ${t.closing ? 'closing' : 'enter'}`}
            onMouseEnter={() => {
              const entry = timers.current.get(t.id);
              if (entry?.timeoutId) {
                clearTimeout(entry.timeoutId);
                const remaining = (entry.expiresAt || 0) - Date.now();
                timers.current.set(t.id, { remaining });
              }
            }}
            onMouseLeave={() => {
              const entry = timers.current.get(t.id);
              const rem = entry?.remaining ?? 1000;
              if (rem > 0) {
                const timeoutId = setTimeout(() => remove(t.id), rem);
                timers.current.set(t.id, { timeoutId, expiresAt: Date.now() + rem });
              }
            }}
          >
            <div className="toast-message">{t.message}</div>
            <button className="toast-close" aria-label="Cerrar" onClick={() => remove(t.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export default ToastContext;
