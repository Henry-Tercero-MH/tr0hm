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
        socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', { auth: { token } });
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

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

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
