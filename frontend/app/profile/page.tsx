'use client';

import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [preferences, setPreferences] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.notificationPreferences) {
      setPreferences(user.notificationPreferences);
    }
  }, [user]);

  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      await api('/me/notifications', {
        method: 'PATCH',
        body: JSON.stringify(preferences),
      });
      alert('Preferences saved!');
    } catch (err) {
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', backgroundColor: '#0d0d0d',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          border: '3px solid rgba(139,92,246,0.3)',
          borderTop: '3px solid #8b5cf6',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#0d0d0d',
      fontFamily: "'DM Sans', sans-serif", color: '#f9fafb',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
      `}</style>

      {/* Background orbs */}
      <div style={{
        position: 'fixed', top: '10%', left: '5%',
        width: '300px', height: '300px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.08), transparent)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />

      {/* Profile content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '3rem 1.5rem' }}>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={logout}
            className="text-sm font-semibold text-zinc-200 border border-zinc-600 rounded-lg px-4 py-2 hover:bg-zinc-800 transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Cover area */}
        <div style={{
          height: '160px', borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.2))',
          border: '1px solid rgba(139,92,246,0.2)',
          marginBottom: '1rem', position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '30px 30px',
          }} />
        </div>

        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', marginBottom: '2rem', marginTop: '-3rem', paddingLeft: '1.5rem' }}>
          <div style={{
            width: '90px', height: '90px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            border: '4px solid #0d0d0d',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', fontWeight: '800', color: 'white',
            fontFamily: "'Syne', sans-serif",
            flexShrink: 0,
          }}>
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div style={{ paddingBottom: '0.5rem' }}>
            <h1 style={{
              fontFamily: "'Syne', sans-serif", fontWeight: '800',
              fontSize: '1.5rem', color: '#f9fafb', marginBottom: '0.25rem',
            }}>
              {user.username}
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{user.email}</p>
          </div>
        </div>

        {/* Info cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>

          {/* Bio card */}
          <div style={{
            background: '#1a1a1a', borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.06)',
            padding: '1.5rem',
          }}>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>BIO</p>
            <p style={{ color: '#f9fafb', fontSize: '0.95rem' }}>
              {user.bio || 'No bio yet.'}
            </p>
          </div>

          {/* Role card */}
          <div style={{
            background: '#1a1a1a', borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.06)',
            padding: '1.5rem',
          }}>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>ROLE</p>
            <span style={{
              padding: '0.25rem 0.75rem', borderRadius: '100px',
              background: user.role === 'admin' ? 'rgba(236,72,153,0.15)' : 'rgba(139,92,246,0.15)',
              border: `1px solid ${user.role === 'admin' ? 'rgba(236,72,153,0.3)' : 'rgba(139,92,246,0.3)'}`,
              color: user.role === 'admin' ? '#ec4899' : '#8b5cf6',
              fontSize: '0.875rem', fontWeight: '600',
            }}>
              {user.role}
            </span>
          </div>

          {/* Notifications card */}
          <div style={{
            background: '#1a1a1a', borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.06)',
            padding: '1.5rem',
          }}>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>NOTIFICATIONS</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(preferences).map(([key, val]) => (
                <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                  <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                    {key === 'newFollower' ? 'New followers' :
                     key === 'newComment' ? 'Comments on my videos' :
                     key === 'newLike' ? 'Likes on my videos' : key}
                  </span>
                  <input
                    type="checkbox"
                    checked={val || false}
                    onChange={(e) => setPreferences(prev => ({ ...prev, [key]: e.target.checked }))}
                    style={{ width: '16px', height: '16px', accentColor: '#8b5cf6' }}
                  />
                </label>
              ))}
            </div>
            <button
              onClick={handleSavePreferences}
              disabled={saving}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                border: 'none',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>

        {/* Edit profile — not wired to API */}
        <button
          type="button"
          className="px-8 py-3 rounded-lg text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors"
        >
          Edit Profile
        </button>
      </div>
    </div>
  );
}