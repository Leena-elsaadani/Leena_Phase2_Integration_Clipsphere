'use client';

import { useState } from 'react';

interface Props {
  videoId: string;
}

export default function ShareButton({ videoId }: Props) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/watch/${videoId}`
    : `/watch/${videoId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 2000);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '100px', padding: '8px 16px', cursor: 'pointer',
          color: '#9ca3af', fontSize: '0.875rem', fontWeight: '600',
          transition: 'all 0.2s ease', fontFamily: "'DM Sans', sans-serif",
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
      >
        ↗ Share
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '120%', left: 0,
          background: '#1a1a1a', border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: '12px', padding: '14px', zIndex: 50,
          minWidth: '270px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}>
          <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: '0 0 8px', fontWeight: '600', letterSpacing: '0.05em' }}>
            SHARE THIS VIDEO
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={url}
              readOnly
              style={{
                flex: 1, padding: '8px 10px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#d1d5db', fontSize: '0.75rem', outline: 'none',
              }}
            />
            <button
              onClick={handleCopy}
              style={{
                padding: '8px 14px', borderRadius: '8px',
                background: copied ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg,#8b5cf6,#ec4899)',
                border: 'none', color: 'white', cursor: 'pointer',
                fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap',
              }}
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}