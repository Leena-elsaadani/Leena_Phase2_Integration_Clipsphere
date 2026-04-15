'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';

interface Stats {
  totalUsers: number;
  totalVideos: number;
  flaggedVideos: number;
  mostActiveUsers: { username: string; email: string; videoCount: number }[];
}

interface Health {
  status: string;
  uptime: number;
  memory: { used: string; total: string };
  database: { status: string };
}

function StatCard({ label, value, icon, accent }: { label: string; value: string | number; icon: string; accent: string }) {
  return (
    <div style={{ background: '#1a1a1a', borderRadius: '14px', padding: '20px 22px', border: `1px solid ${accent}25` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <p style={{ color: '#6b7280', fontSize: '0.72rem', fontWeight: '600', letterSpacing: '0.05em', margin: 0 }}>{label}</p>
        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
      </div>
      <p style={{ margin: 0, fontSize: '1.9rem', fontWeight: '800', fontFamily: "'Syne', sans-serif", background: `linear-gradient(135deg, ${accent}, #ec4899)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
        {value}
      </p>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    // Admin role protection — client-side guard (server-side handled by middleware.ts)
    if (!user || user.role !== 'admin') {
      router.replace('/');
      return;
    }
    Promise.all([api('/admin/stats'), api('/admin/health')])
      .then(([statsRes, healthRes]) => {
        setStats(statsRes.data);
        setHealth(healthRes.data);
      })
      .catch((err) => setError(err.message || 'Failed to load admin data'))
      .finally(() => setDataLoading(false));
  }, [user, authLoading, router]);

  if (authLoading || dataLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '50%', border: '3px solid rgba(139,92,246,0.3)', borderTop: '3px solid #8b5cf6', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#6b7280', fontSize: '0.875rem', fontFamily: "'DM Sans', sans-serif" }}>Loading admin dashboard...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user || user.role !== 'admin') return null;

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', fontFamily: "'DM Sans', sans-serif", color: '#f9fafb' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap'); @keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Navbar */}
      <nav style={{ padding: '1rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(13,13,13,0.95)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: '800', fontSize: '1.2rem', background: 'linear-gradient(135deg,#8b5cf6,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>ClipSphere</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ padding: '3px 12px', borderRadius: '100px', background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.3)', color: '#ec4899', fontSize: '0.72rem', fontWeight: '700' }}>ADMIN</span>
          <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>@{user.username}</span>
        </div>
      </nav>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '4px' }}>
            <div style={{ width: '4px', height: '26px', background: 'linear-gradient(to bottom,#8b5cf6,#ec4899)', borderRadius: '2px' }} />
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: '800', fontSize: '1.75rem', color: '#f9fafb', margin: 0 }}>Admin Dashboard</h1>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginLeft: '16px' }}>Platform statistics and system health</p>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '2rem', background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.3)', color: '#ec4899', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {/* Stats cards */}
        {stats && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <StatCard label="TOTAL USERS" value={stats.totalUsers.toLocaleString()} icon="👥" accent="#8b5cf6" />
              <StatCard label="TOTAL VIDEOS" value={stats.totalVideos.toLocaleString()} icon="🎬" accent="#8b5cf6" />
              <StatCard label="FLAGGED VIDEOS" value={stats.flaggedVideos} icon="🚩" accent="#ec4899" />
              <StatCard
                label="DATABASE"
                value={health?.database.status === 'connected' ? 'Online' : 'Offline'}
                icon={health?.database.status === 'connected' ? '🟢' : '🔴'}
                accent={health?.database.status === 'connected' ? '#10b981' : '#ef4444'}
              />
            </div>

            {/* Top uploaders */}
            {stats.mostActiveUsers.length > 0 && (
              <div style={{ background: '#1a1a1a', borderRadius: '14px', padding: '20px 22px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.5rem' }}>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: '700', fontSize: '0.95rem', color: '#f9fafb', margin: '0 0 14px' }}>🏆 Top Uploaders This Week</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stats.mostActiveUsers.map((u, i) => (
                    <div key={u.username} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: i === 0 ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : i === 1 ? 'linear-gradient(135deg,#9ca3af,#6b7280)' : 'linear-gradient(135deg,#92400e,#78350f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '700', color: 'white', flexShrink: 0 }}>{i + 1}</span>
                        <div>
                          <p style={{ margin: 0, color: '#f9fafb', fontWeight: '600', fontSize: '0.875rem' }}>@{u.username}</p>
                          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.72rem' }}>{u.email}</p>
                        </div>
                      </div>
                      <span style={{ padding: '3px 10px', borderRadius: '100px', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', fontSize: '0.78rem', fontWeight: '600' }}>{u.videoCount} videos</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* System health */}
        {health && (
          <div style={{ background: '#1a1a1a', borderRadius: '14px', padding: '20px 22px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: '700', fontSize: '0.95rem', color: '#f9fafb', margin: '0 0 14px' }}>⚡ System Health</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: '10px' }}>
              {[
                { label: 'STATUS', value: health.status.toUpperCase(), ok: health.status === 'ok' },
                { label: 'DATABASE', value: health.database.status, ok: health.database.status === 'connected' },
                { label: 'UPTIME', value: `${Math.floor(health.uptime / 60)}m ${health.uptime % 60}s`, ok: true },
                { label: 'MEM USED', value: health.memory.used, ok: true },
                { label: 'MEM TOTAL', value: health.memory.total, ok: true },
              ].map((item) => (
                <div key={item.label} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <p style={{ margin: '0 0 3px', color: '#6b7280', fontSize: '0.68rem', fontWeight: '600', letterSpacing: '0.05em' }}>{item.label}</p>
                  <p style={{ margin: 0, color: item.ok ? '#10b981' : '#ef4444', fontWeight: '700', fontSize: '0.9rem' }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}