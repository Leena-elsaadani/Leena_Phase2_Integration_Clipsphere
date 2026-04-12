'use client';

import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

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

      {/* Navbar */}
      <nav style={{
        padding: '1rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'rgba(13,13,13,0.95)', backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{
            fontFamily: "'Syne', sans-serif", fontWeight: '800', fontSize: '1.2rem',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>ClipSphere</span>
        </Link>
        <button
          onClick={logout}
          style={{
            padding: '0.5rem 1.25rem', borderRadius: '100px',
            border: '1px solid rgba(236,72,153,0.4)',
            background: 'transparent', color: '#ec4899',
            cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget.style.background = 'rgba(236,72,153,0.1)');
            (e.currentTarget.style.boxShadow = '0 0 15px rgba(236,72,153,0.3)');
          }}
          onMouseLeave={e => {
            (e.currentTarget.style.background = 'transparent');
            (e.currentTarget.style.boxShadow = 'none');
          }}
        >
          Logout
        </button>
      </nav>

      {/* Profile content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '3rem 1.5rem' }}>

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {Object.entries(user.notificationPreferences).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{key}</span>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    backgroundColor: val ? '#8b5cf6' : '#374151',
                  }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Edit profile button */}
        <button style={{
          padding: '0.75rem 2rem', borderRadius: '100px',
          background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
          border: 'none', color: 'white', cursor: 'pointer',
          fontSize: '0.875rem', fontWeight: '700',
          fontFamily: "'Syne', sans-serif",
          transition: 'all 0.3s ease',
          boxShadow: '0 0 20px rgba(139,92,246,0.3)',
        }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 30px rgba(139,92,246,0.6)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 20px rgba(139,92,246,0.3)')}
        >
          Edit Profile
        </button>
      </div>
    </div>
  );
}