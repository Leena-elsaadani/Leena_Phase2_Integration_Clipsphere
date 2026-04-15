'use client';

import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface Comment {
  _id: string;
  text: string;
  user: { _id: string; username: string; avatarUrl?: string };
  createdAt: string;
}

interface Props {
  videoId: string;
  currentUserId?: string;
}

export default function CommentSection({ videoId, currentUserId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api(`/videos/${videoId}/comments`)
      .then((res) => setComments(res.data.comments))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [videoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || submitting) return;

    const saved = text.trim();
    // Optimistic add
    const optimistic: Comment = {
      _id: `temp-${Date.now()}`,
      text: saved,
      user: { _id: currentUserId || '', username: 'You' },
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [optimistic, ...prev]);
    setText('');
    setSubmitting(true);

    try {
      const res = await api(`/videos/${videoId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text: saved }),
      });
      setComments((prev) =>
        prev.map((c) => (c._id === optimistic._id ? res.data.comment : c))
      );
    } catch {
      setComments((prev) => prev.filter((c) => c._id !== optimistic._id));
      setText(saved);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    setComments((prev) => prev.filter((c) => c._id !== commentId));
    try {
      await api(`/videos/${videoId}/comments/${commentId}`, { method: 'DELETE' });
    } catch {
      const res = await api(`/videos/${videoId}/comments`);
      setComments(res.data.comments);
    }
  };

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: '700', fontSize: '1rem', color: '#f9fafb', marginBottom: '1rem' }}>
        Comments ({comments.length})
      </h3>

      {currentUserId && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '1.25rem' }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
            maxLength={300}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#f9fafb', fontSize: '0.875rem', outline: 'none',
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            style={{
              padding: '10px 18px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              border: 'none', color: 'white', fontWeight: '600', cursor: 'pointer',
              opacity: submitting || !text.trim() ? 0.6 : 1,
              fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem',
            }}
          >
            Post
          </button>
        </form>
      )}

      {fetching ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading...</p>
      ) : comments.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No comments yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {comments.map((c) => (
            <div key={c._id} style={{
              background: '#1a1a1a', borderRadius: '12px', padding: '14px 16px',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.65rem', fontWeight: '700', color: 'white', flexShrink: 0,
                  }}>
                    {c.user.username.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ color: '#a78bfa', fontWeight: '600', fontSize: '0.8rem' }}>@{c.user.username}</span>
                  <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
                <p style={{ color: '#d1d5db', fontSize: '0.875rem', margin: 0, lineHeight: '1.5' }}>{c.text}</p>
              </div>
              {currentUserId && c.user._id === currentUserId && (
                <button
                  onClick={() => handleDelete(c._id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280',
                    fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ec4899'; e.currentTarget.style.background = 'rgba(236,72,153,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = 'none'; }}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}