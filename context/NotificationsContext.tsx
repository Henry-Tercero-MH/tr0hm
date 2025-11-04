import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import api from '../lib/api';

type Notification = {
  id: number;
  type: string;
  payload?: any;
  read: boolean;
  createdAt: string;
};

type MessagesReadPayload = { by: number; count?: number };

type ContextValue = {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: number) => Promise<void>;
  addMessagesReadListener: (fn: (p: MessagesReadPayload) => void) => void;
  removeMessagesReadListener: (fn: (p: MessagesReadPayload) => void) => void;
};

const NotificationsContext = createContext<ContextValue | undefined>(undefined);

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
};

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const messagesReadListeners = useRef(new Set<(p: MessagesReadPayload) => void>());

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    let socket: any;

    // fetch initial notifications using api client (adds Authorization)
    api
      .get('/api/notifications')
      .then((r) => setNotifications(r.data || []))
      .catch(() => {});

    // connect socket dynamically to avoid SSR issues
      (async () => {
        try {
          const { io } = await import('socket.io-client');
          // include credentials so cookie-based sessions are sent to the server
          socket = io(process.env.NEXT_PUBLIC_API_URL || 'https://trohm-production.up.railway.app', { auth: { token }, withCredentials: true });
        socket.on('connect', () => {
          // console.log('notif socket connected', socket.id);
        });
        socket.on('notification', (n: any) => {
          setNotifications((prev) => [
            {
              id: n.id ?? Date.now(),
              type: n.type || 'event',
              payload: n.payload || n,
              read: false,
              createdAt: new Date().toISOString()
            },
            ...prev
          ]);
          // also show a system notification if permission granted and service worker available
          try {
            if (typeof window !== 'undefined' && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistration().then((reg) => {
                if (reg) reg.showNotification(n.title || 'Notificación', { body: n.body || n.payload?.body || 'Tienes una nueva notificación', data: n, icon: '/icons/icon-192.svg' });
              }).catch(() => {});
            }
          } catch (e) {}
        });
        socket.on('messagesRead', (p: any) => {
          try {
            messagesReadListeners.current.forEach((fn) => {
              try { fn(p); } catch (e) { /* ignore listener errors */ }
            });
          } catch (e) {}
        });
      } catch (e) {
        // ignore
      }
    })();

    // register service worker and subscribe to push notifications (if supported)
    (async function setupPush() {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        // avoid prompting repeatedly
        if (Notification.permission === 'denied') return;

        const reg = await navigator.serviceWorker.register('/sw.js');
        // ask permission if not yet granted
        if (Notification.permission !== 'granted') {
          const p = await Notification.requestPermission();
          if (p !== 'granted') return;
        }

  // Public VAPID key used to subscribe the client to PushManager.
  // It's safe for this public key to be embedded in client code;
  // the private key MUST remain on the server and never be exposed.
  const VAPID_PUBLIC_KEY_FALLBACK = 'BME89Ou996yHKe_x8NSC11GQn-1Dbya5zU0W57QY4c_hVK9bio2L4AxDV0m6YY5WBsGBEdbBuF5VqlbAWbQdwqc';
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY_FALLBACK;
  if (!vapidKey) return;

        const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
        // send subscription to backend
        await api.post('/api/push/subscribe', sub);
      } catch (e) {
        // ignore push errors
      }
    })();

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  // small helper: convert base64 URL to Uint8Array
  function urlBase64ToUint8Array(base64String: any) {
    try {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    } catch (e) {
      return new Uint8Array();
    }
  }

  const markAsRead = async (id: number) => {
    try {
      await api.post(`/api/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (e) {
      // ignore
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addMessagesReadListener = useCallback((fn: (p: MessagesReadPayload) => void) => {
    messagesReadListeners.current.add(fn);
  }, []);

  const removeMessagesReadListener = useCallback((fn: (p: MessagesReadPayload) => void) => {
    messagesReadListeners.current.delete(fn);
  }, []);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAsRead, addMessagesReadListener, removeMessagesReadListener }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export default NotificationsContext;
