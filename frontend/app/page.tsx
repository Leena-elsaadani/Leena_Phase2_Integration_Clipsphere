'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { videoApi } from '@/lib/api';
import { useAuth } from '../hooks/useAuth';

function formatDuration(secs: number) {
  if (!secs || Number.isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatViewsHome(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const CATEGORIES = ['🔥 Trending', '🎯 For You', '🎬 Cinema', '🎵 Music', '🌍 Travel', '⚡ Action'];

export default function Home() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState('🔥 Trending');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const [feedVideos, setFeedVideos] = useState<
    {
      _id: string;
      title: string;
      duration?: number;
      viewsCount?: number;
      views?: number;
      owner?: { username?: string };
      uploader?: { username?: string };
      createdAt?: string;
    }[]
  >([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFeedLoading(true);
    setFeedError(null);
    videoApi
      .getFeed(8, 0)
      .then((res) => {
        if (!cancelled) {
          setFeedVideos(res.data?.videos ?? []);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setFeedError(err.message || 'Could not load videos');
          setFeedVideos([]);
        }
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ backgroundColor: '#0d0d0d', minHeight: '100vh', fontFamily: "'Syne', sans-serif" }}>

      {/* Noise texture overlay */}
      <div className="noise-overlay" />

      {/* Ambient background orbs */}
      <div style={{
        position: 'fixed', top: '10%', left: '5%', width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
        filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'fixed', bottom: '20%', right: '5%', width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
        filter: 'blur(60px)',
      }} />

      {/* ═══ HERO SECTION ═══ */}
      <section ref={heroRef} style={{
        position: 'relative', height: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* Animated grid background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(139,92,246,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.07) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        }} />

        {/* Scanline effect */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.4), transparent)',
          animation: 'scanline 4s linear infinite',
          pointerEvents: 'none',
        }} />

        {/* Floating orb */}
        <div className="animate-float" style={{
          position: 'absolute', top: '20%', right: '15%',
          width: '120px', height: '120px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.6), rgba(236,72,153,0.3))',
          filter: 'blur(2px)',
          boxShadow: '0 0 60px rgba(139,92,246,0.5)',
        }} />
        <div className="animate-float" style={{
          animationDelay: '-3s',
          position: 'absolute', bottom: '25%', left: '10%',
          width: '80px', height: '80px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(236,72,153,0.5), rgba(139,92,246,0.2))',
          filter: 'blur(1px)',
          boxShadow: '0 0 40px rgba(236,72,153,0.4)',
        }} />

        {/* Hero content */}
        <div style={{ textAlign: 'center', zIndex: 10, padding: '0 1rem', maxWidth: '900px' }}>
          <div style={{
            display: 'inline-block', marginBottom: '1.5rem',
            padding: '0.4rem 1rem', borderRadius: '100px',
            border: '1px solid rgba(139,92,246,0.4)',
            background: 'rgba(139,92,246,0.1)',
            backdropFilter: 'blur(10px)',
          }}>
            <span style={{ color: '#a78bfa', fontSize: '0.8rem', fontWeight: '600', letterSpacing: '0.1em', fontFamily: "'DM Sans', sans-serif" }}>
              ✦ SHORT VIDEO PLATFORM
            </span>
          </div>

          <h1 className="hero-text animate-slide-in" style={{
            fontSize: 'clamp(3.5rem, 10vw, 7rem)',
            fontWeight: '800', lineHeight: '1',
            marginBottom: '1.5rem',
            fontFamily: "'Syne', sans-serif",
            letterSpacing: '-0.02em',
          }}>
            {user ? (
              <>Create.<br />Share.<br />Go Viral.</>
            ) : (
              <>Welcome to<br />ClipSphere</>
            )}
          </h1>

          <p style={{
            color: '#6b7280', fontSize: 'clamp(1rem, 2vw, 1.2rem)',
            marginBottom: '2.5rem', maxWidth: '500px', margin: '0 auto 2.5rem',
            fontFamily: "'DM Sans', sans-serif", fontWeight: '300', lineHeight: '1.7',
          }}>
            The cinematic short-video platform where creators become legends.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href={user ? "/upload" : "/register"} className="animate-pulse-glow" style={{
              padding: '0.875rem 2rem', borderRadius: '100px',
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              color: 'white', textDecoration: 'none',
              fontSize: '1rem', fontWeight: '700',
              fontFamily: "'Syne', sans-serif",
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            }}>
              {user ? 'Upload your next clip ↗' : 'Start Creating ↗'}
            </Link>
            <Link
              href="/feed"
              style={{
                padding: '0.875rem 2rem', borderRadius: '100px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#f9fafb', cursor: 'pointer',
                fontSize: '1rem', fontWeight: '500',
                fontFamily: "'DM Sans', sans-serif",
                backdropFilter: 'blur(10px)',
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                transition: 'all 0.3s ease',
                textDecoration: 'none',
              }}
            >
              ▶ Watch feed
            </Link>
          </div>

          {/* Stats */}
          <div style={{
            display: 'flex', gap: '3rem', justifyContent: 'center',
            marginTop: '4rem', flexWrap: 'wrap',
          }}>
            {[['10M+', 'Creators'], ['500M+', 'Views Daily'], ['190+', 'Countries']].map(([num, label]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '1.75rem', fontWeight: '800', fontFamily: "'Syne', sans-serif",
                  background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>{num}</div>
                <div style={{ color: '#6b7280', fontSize: '0.8rem', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.05em' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
          color: '#6b7280', fontSize: '0.75rem', fontFamily: "'DM Sans', sans-serif",
          letterSpacing: '0.1em',
        }}>
          <span>SCROLL</span>
          <div className="animate-float" style={{ width: '1px', height: '40px', background: 'linear-gradient(to bottom, #8b5cf6, transparent)' }} />
        </div>
      </section>

      {/* ═══ CATEGORIES ═══ */}
      <section style={{ padding: '4rem 2rem 2rem', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className="category-pill"
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '0.5rem 1.25rem', borderRadius: '100px',
                  border: activeCategory === cat ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  background: activeCategory === cat
                    ? 'linear-gradient(135deg, #8b5cf6, #ec4899)'
                    : 'rgba(255,255,255,0.04)',
                  color: activeCategory === cat ? 'white' : '#6b7280',
                  cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600',
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: activeCategory === cat ? '0 0 20px rgba(139,92,246,0.4)' : 'none',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ VIDEO FEED ═══ */}
      <section style={{ padding: '2rem', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '4px', height: '24px', background: 'linear-gradient(to bottom, #8b5cf6, #ec4899)', borderRadius: '2px' }} />
              <h2 style={{
                color: '#f9fafb', fontWeight: '800', fontSize: '1.5rem',
                fontFamily: "'Syne', sans-serif",
              }}>
                Latest from the community
              </h2>
            </div>
            <Link
              href="/feed"
              style={{
                color: '#8b5cf6', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600',
                fontFamily: "'DM Sans', sans-serif",
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                textDecoration: 'none',
              }}
            >
              See all →
            </Link>
          </div>

          {feedError && (
            <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem', fontFamily: "'DM Sans', sans-serif" }}>
              {feedError}
            </p>
          )}

          {feedLoading && (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem', fontFamily: "'DM Sans', sans-serif" }}>
              Loading videos…
            </p>
          )}

          {/* Dynamic grid — data from GET /api/v1/videos */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.25rem',
          }}>
            {!feedLoading && feedVideos.length === 0 && !feedError && (
              <p style={{ color: '#6b7280', fontSize: '0.875rem', gridColumn: '1 / -1', fontFamily: "'DM Sans', sans-serif" }}>
                No public videos yet. Upload one from the feed or upload page once you&apos;re logged in.
              </p>
            )}
            {feedVideos.map((video, i) => {
              const vid = video._id;
              const creator = video.uploader ?? video.owner;
              const views = video.views ?? video.viewsCount ?? 0;
              return (
                <Link
                  key={vid}
                  href={`/watch/${vid}`}
                  className="card-hover"
                  onMouseEnter={() => setHoveredCard(vid)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    borderRadius: '16px', overflow: 'hidden', cursor: 'pointer',
                    textDecoration: 'none',
                    border: hoveredCard === vid
                      ? '1px solid rgba(139,92,246,0.5)'
                      : '1px solid rgba(255,255,255,0.06)',
                    background: '#1a1a1a',
                    boxShadow: hoveredCard === vid
                      ? '0 20px 60px rgba(139,92,246,0.25), 0 0 0 1px rgba(139,92,246,0.2)'
                      : '0 4px 20px rgba(0,0,0,0.4)',
                    position: 'relative',
                  }}
                >
                  <div style={{
                    height: '200px', position: 'relative', overflow: 'hidden',
                    background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                  }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: `linear-gradient(135deg, ${
                        i % 3 === 0 ? 'rgba(139,92,246,0.4), rgba(236,72,153,0.2)' :
                        i % 3 === 1 ? 'rgba(236,72,153,0.4), rgba(139,92,246,0.2)' :
                        'rgba(99,102,241,0.4), rgba(139,92,246,0.2)'
                      })`,
                      transition: 'all 0.4s ease',
                      transform: hoveredCard === vid ? 'scale(1.1)' : 'scale(1)',
                    }} />
                    <div style={{
                      position: 'absolute', inset: 0,
                      backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                      backgroundSize: '20px 20px',
                    }} />
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: hoveredCard === vid ? 1 : 0,
                      transition: 'opacity 0.3s ease',
                    }}>
                      <div style={{
                        width: '56px', height: '56px', borderRadius: '50%',
                        background: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(10px)',
                        border: '2px solid rgba(255,255,255,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 30px rgba(139,92,246,0.5)',
                      }}>
                        <span style={{ color: 'white', fontSize: '1.25rem', marginLeft: '4px' }}>▶</span>
                      </div>
                    </div>
                    <div style={{
                      position: 'absolute', top: '0.75rem', right: '0.75rem',
                      padding: '0.25rem 0.6rem', borderRadius: '100px',
                      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
                      color: '#f9fafb', fontSize: '0.7rem', fontWeight: '600',
                      fontFamily: "'DM Sans', sans-serif",
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                      👁 {formatViewsHome(views)}
                    </div>
                    <div style={{
                      position: 'absolute', bottom: '0.75rem', left: '0.75rem',
                      padding: '0.2rem 0.5rem', borderRadius: '4px',
                      background: 'rgba(0,0,0,0.8)',
                      color: '#f9fafb', fontSize: '0.7rem', fontWeight: '600',
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {formatDuration(video.duration ?? 0)}
                    </div>
                  </div>
                  <div style={{ padding: '1rem' }}>
                    <h3 style={{
                      color: '#f9fafb', fontWeight: '700', fontSize: '0.95rem',
                      fontFamily: "'Syne', sans-serif", marginBottom: '0.35rem',
                    }}>
                      {video.title}
                    </h3>
                    <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '0.5rem', fontFamily: "'DM Sans', sans-serif" }}>
                      @{creator?.username ?? 'Unknown'}
                    </p>
                    <span style={{ color: '#8b5cf6', fontSize: '0.8rem', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                      Watch →
                    </span>
                  </div>
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px',
                    background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
                    opacity: hoveredCard === vid ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                  }} />
                </Link>
              );
            })}
          </div>

          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Link
              href="/feed"
              className="glow-btn"
              style={{
                display: 'inline-block',
                padding: '0.875rem 2.5rem', borderRadius: '100px',
                border: '1px solid rgba(139,92,246,0.4)',
                background: 'transparent', color: '#f9fafb', cursor: 'pointer',
                fontSize: '0.875rem', fontWeight: '600',
                fontFamily: "'DM Sans', sans-serif",
                position: 'relative', zIndex: 1,
                textDecoration: 'none',
              }}
            >
              Open full discovery feed
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ CTA SECTION ═══ */}
      <section style={{ padding: '6rem 2rem', position: 'relative', zIndex: 10, textAlign: 'center' }}>
        <div style={{
          maxWidth: '700px', margin: '0 auto',
          padding: '4rem 2rem', borderRadius: '24px',
          border: '1px solid rgba(139,92,246,0.2)',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(236,72,153,0.05))',
          backdropFilter: 'blur(20px)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)',
            width: '300px', height: '300px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.2), transparent)',
            pointerEvents: 'none',
          }} />
          <h2 style={{
            fontFamily: "'Syne', sans-serif", fontWeight: '800',
            fontSize: 'clamp(2rem, 5vw, 3rem)', color: '#f9fafb',
            marginBottom: '1rem', position: 'relative',
          }}>
            Ready to go viral?
          </h2>
          <p style={{
            color: '#6b7280', marginBottom: '2rem',
            fontFamily: "'DM Sans', sans-serif", fontSize: '1rem',
            position: 'relative',
          }}>
            {user ? `Welcome back, @${user.username}. Keep creating.` : 'Join millions of creators on ClipSphere today.'}
          </p>
          <Link href={user ? "/upload" : "/register"} className="animate-pulse-glow" style={{
            padding: '1rem 2.5rem', borderRadius: '100px',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            color: 'white', textDecoration: 'none',
            fontSize: '1rem', fontWeight: '700',
            fontFamily: "'Syne', sans-serif",
            display: 'inline-block', position: 'relative',
          }}>
            {user ? 'Upload New Video ↗' : 'Join ClipSphere Free ↗'}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '2rem', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)',
        color: '#6b7280', fontSize: '0.8rem', fontFamily: "'DM Sans', sans-serif",
        position: 'relative', zIndex: 10,
      }}>
        © 2026 ClipSphere · Built with ♥
      </footer>
    </div>
  );
}