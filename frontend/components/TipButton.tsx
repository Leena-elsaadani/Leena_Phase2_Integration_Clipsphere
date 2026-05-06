'use client';
import { useState } from 'react';
import { api } from '../services/api';
import { tipSchema } from '../lib/validators';

const PRESET_AMOUNTS = [100, 300, 500, 1000]; // cents

interface Props {
  videoId: string;
  recipientId: string;
  recipientUsername: string;
  currentUserId?: string;
}

export default function TipButton({ videoId, recipientId, recipientUsername, currentUserId }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!currentUserId || currentUserId === recipientId) return null;

  const getAmount = () => {
    if (custom) return Math.round(parseFloat(custom) * 100);
    return selected;
  };

  const handleTip = async () => {
    const amount = getAmount();
    if (!amount || Number.isNaN(amount)) {
      setError('Please enter a valid tip amount.');
      return;
    }

    const amountDollars = amount / 100;
    const validation = tipSchema.safeParse({ amount: amountDollars });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || 'Amount must be between $1 and $500');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ recipientId, videoId, amountCents: amount }),
      });
      window.location.href = res.data.url;
    } catch (err: any) {
      setError(err.message || 'Failed to start checkout');
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.1))',
          border: '1px solid rgba(139,92,246,0.4)',
          borderRadius: '100px', padding: '8px 16px', cursor: 'pointer',
          color: '#c4b5fd', fontSize: '0.875rem', fontWeight: '600',
          transition: 'all 0.2s ease',
        }}
      >
        💜 Tip @{recipientUsername}
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '120%', left: 0,
          background: 'rgba(26,26,26,0.95)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(139,92,246,0.3)', borderRadius: '16px',
          padding: '20px', zIndex: 50, minWidth: '280px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        }}>
          <p style={{ color: '#f9fafb', fontWeight: '700', marginBottom: '12px', fontSize: '0.95rem' }}>
            Choose tip amount
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            {PRESET_AMOUNTS.map((amt) => (
              <button key={amt}
                onClick={() => { setSelected(amt); setCustom(''); }}
                style={{
                  padding: '10px', borderRadius: '10px', border: 'none',
                  background: selected === amt && !custom ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' : 'rgba(255,255,255,0.07)',
                  color: '#f9fafb', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem',
                }}>
                ${(amt / 100).toFixed(0)}
              </button>
            ))}
          </div>
          <input
            type="number" placeholder="Custom amount ($)" value={custom}
            onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
            style={{
              width: '100%', padding: '10px', borderRadius: '10px', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#f9fafb', marginBottom: '12px', fontSize: '0.875rem',
            }}
          />
          {error && <p style={{ color: '#ec4899', fontSize: '0.8rem', marginBottom: '8px' }}>{error}</p>}
          <button
            onClick={handleTip} disabled={loading || (!selected && !custom)}
            style={{
              width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              color: 'white', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, fontSize: '0.9rem',
            }}>
            {loading ? 'Redirecting to Stripe...' : `Send Tip 💜`}
          </button>
        </div>
      )}
    </div>
  );
}