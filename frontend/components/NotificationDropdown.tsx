'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from './GlassCard';
import { useNotifications } from '../context/NotificationContext';

const TYPE_ICONS = { like: '💜', comment: '💬', review: '⭐' } as const;

export default function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleToggle = () => setOpen((prev) => !prev);

  const handleNotificationClick = (id: string, videoId?: string) => {
    markAsRead(id);
    setOpen(false);
    if (videoId) {
      router.push(`/watch/${videoId}`);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '42px',
          height: '42px',
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.04)',
          color: '#f8fafc',
          cursor: 'pointer',
          transition: 'transform 0.2s ease',
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>🔔</span>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            minWidth: '18px',
            height: '18px',
            borderRadius: '999px',
            background: '#ec4899',
            color: 'white',
            fontSize: '0.7rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 5px',
            fontWeight: 700,
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <GlassCard style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 8px)',
          width: '360px',
          maxWidth: 'calc(100vw - 1rem)',
          maxHeight: '420px',
          overflow: 'hidden',
          padding: '0',
          zIndex: 50,
        }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, color: '#f9fafb', fontWeight: 700, fontSize: '0.95rem' }}>Notifications</p>
              <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '0.78rem' }}>
                {unreadCount > 0 ? `${unreadCount} unread` : 'No unread alerts'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#8b5cf6',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: '330px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '22px 18px', color: '#9ca3af', fontSize: '0.9rem' }}>
                No notifications yet. Stay tuned.
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification.id, notification.videoId)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 18px',
                    border: 'none',
                    background: notification.read ? 'rgba(255,255,255,0.02)' : 'rgba(139,92,246,0.08)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    color: '#f9fafb',
                    cursor: 'pointer',
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr',
                    gap: '12px',
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{TYPE_ICONS[notification.type]}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.4, color: '#f9fafb' }}>
                      {notification.message}
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                      {new Date(notification.timestamp).toLocaleString()}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
