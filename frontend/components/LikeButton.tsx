'use client';

import { useState } from 'react';
import { api } from '../services/api';

interface Props {
  videoId: string;
  initialCount: number;
  initialLiked?: boolean;
}

export default function LikeButton({ videoId, initialCount, initialLiked = false }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  const handleToggle = async () => {
    if (pending) return;
    // Optimistic update
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => (nextLiked ? c + 1 : c - 1));
    setPending(true);
    try {
      if (nextLiked) {
        await api(`/videos/${videoId}/likes`, { method: 'POST' });
      } else {
        await api(`/videos/${videoId}/likes`, { method: 'DELETE' });
      }
    } catch {
      // Revert on error
      setLiked(!nextLiked);
      setCount((c) => (nextLiked ? c - 1 : c + 1));
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: liked ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${liked ? 'rgba(236,72,153,0.5)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '100px', padding: '8px 16px', cursor: pending ? 'not-allowed' : 'pointer',
        color: liked ? '#ec4899' : '#9ca3af',
        fontSize: '0.875rem', fontWeight: '600',
        transition: 'all 0.2s ease',
        opacity: pending ? 0.7 : 1,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <span style={{ fontSize: '1rem', transition: 'transform 0.15s ease', transform: liked ? 'scale(1.2)' : 'scale(1)', display: 'inline-block' }}>
        {liked ? '♥' : '♡'}
      </span>
      <span>{count.toLocaleString()}</span>
    </button>
  );
}