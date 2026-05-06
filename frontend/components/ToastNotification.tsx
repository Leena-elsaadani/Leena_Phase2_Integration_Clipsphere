'use client';
import { useEffect, useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useRouter } from 'next/navigation';

const TYPE_ICONS = { like: '💜', comment: '💬', review: '⭐' };

export default function ToastNotification() {
  const { notifications } = useNotifications();
  const router = useRouter();
  const [visible, setVisible] = useState<string[]>([]);

  useEffect(() => {
    const latest = notifications[0];
    if (!latest || latest.read || visible.includes(latest.id)) return;
    setVisible((prev) => [latest.id, ...prev].slice(0, 3));
    const timer = setTimeout(() => {
      setVisible((prev) => prev.filter((id) => id !== latest.id));
    }, 4000);
    return () => clearTimeout(timer);
  }, [notifications]);

  const toastsToShow = notifications.filter((n) => visible.includes(n.id));

  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {toastsToShow.map((n) => (
        <div key={n.id}
          onClick={() => n.videoId && router.push(`/watch/${n.videoId}`)}
          style={{
            background: 'rgba(26,26,26,0.85)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px',
            padding: '12px 16px', maxWidth: '320px', cursor: n.videoId ? 'pointer' : 'default',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'slideInRight 0.3s ease',
            position: 'relative', overflow: 'hidden',
          }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.25rem' }}>{TYPE_ICONS[n.type]}</span>
            <p style={{ color: '#f9fafb', fontSize: '0.875rem', margin: 0, lineHeight: 1.4 }}>
              {n.message}
            </p>
          </div>
          {/* Progress bar */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px',
            background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
            animation: 'shrinkWidth 4s linear forwards' }} />
        </div>
      ))}
      <style>{`
        @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes shrinkWidth { from { width: 100%; } to { width: 0%; } }
      `}</style>
    </div>
  );
}