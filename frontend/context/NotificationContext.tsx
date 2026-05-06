'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'review';
  message: string;
  videoId?: string;
  read: boolean;
  timestamp: string;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllRead: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setNotifications([]);
      return;
    }

    if (socketRef.current) {
      return;
    }

    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000', {
      withCredentials: true,
      auth: {
        userId: user._id,
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (user._id) {
        socket.emit('join', { room: `user:${user._id}` });
      }
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connect error:', err);
    });

    socket.on('disconnect', (reason) => {
      console.info('Socket disconnected:', reason);
    });

    const handleNotification = (data: any, type: Notification['type']) => {
      const notif: Notification = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        message: buildMessage(type, data),
        videoId: data.videoId,
        read: false,
        timestamp: data.timestamp || new Date().toISOString(),
      };
      setNotifications((prev) => [notif, ...prev].slice(0, 50));
    };

    socket.on('notification:like', (d) => handleNotification(d, 'like'));
    socket.on('notification:comment', (d) => handleNotification(d, 'comment'));
    socket.on('notification:review', (d) => handleNotification(d, 'review'));

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('disconnect');
      socket.off('notification:like');
      socket.off('notification:comment');
      socket.off('notification:review');
      socket.disconnect();
    };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const markAsRead = (id: string) =>
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

function buildMessage(type: string, data: any) {
  if (type === 'like') return `@${data.actorUsername} liked "${data.videoTitle}"`;
  if (type === 'comment') return `@${data.actorUsername} commented on "${data.videoTitle}"`;
  if (type === 'review') return `@${data.actorUsername} reviewed "${data.videoTitle}"`;
  return 'New notification';
}

export const useNotifications = () => useContext(NotificationContext);