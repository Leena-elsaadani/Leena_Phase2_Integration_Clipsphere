'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { videoApi } from '@/lib/api';
import { api } from '../../../services/api';
import LikeButton from '../../../components/LikeButton';
import ShareButton from '../../../components/ShareButton';
import CommentSection from '../../../components/CommentSection';
import ReviewSection from '../../../components/ReviewSection';
import { useAuth } from '../../../hooks/useAuth';

function formatDuration(secs) {
  if (!secs) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function WatchPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const videoRef = useRef(null);
  const [streamURL, setStreamURL] = useState(null);
  const [videoMeta, setVideoMeta] = useState(null);
  const [likesCount, setLikesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Player state
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (!id) return;

    async function fetchAll() {
      try {
        const streamRes = await videoApi.getStreamURL(id);
        const url = streamRes?.data?.url;
        if (url) setStreamURL(url);
      } catch {
        // Stream route may be unavailable or user unauthenticated — not fatal
      }

      try {
        const feedRes = await api('/videos?limit=500&skip=0');
        const list = feedRes.data?.videos || [];
        const found = list.find((v) => String(v._id) === String(id));
        if (found) {
          setVideoMeta(found);
          try {
            const likesRes = await api(`/videos/${id}/likes`);
            setLikesCount(likesRes.data?.likesCount ?? 0);
          } catch {
            setLikesCount(0);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [id]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); } else { videoRef.current.play(); }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
    setProgress(isNaN(p) ? 0 : p);
    setCurrentTime(Math.floor(videoRef.current.currentTime));
  };

  const handleSeek = (e) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = ratio * (videoRef.current.duration || 0);
  };

  // Dynamic ownership — API may populate `owner` or `uploader` depending on schema
  const ownerId =
    videoMeta?.owner?._id ||
    videoMeta?.owner ||
    videoMeta?.uploader?._id ||
    videoMeta?.uploader;
  const isOwner =
    user && ownerId && String(user._id) === String(ownerId);
  const isAdmin = user?.role === 'admin';

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-zinc-700 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-white">
        <p className="text-red-400">{error}</p>
        <button onClick={() => router.back()} className="text-sm text-zinc-400 hover:text-white underline">← Back</button>
      </div>
    );
  }

  const duration = videoMeta?.duration || 0;

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', fontFamily: "'DM Sans', sans-serif", color: '#f9fafb' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');`}</style>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem 1.5rem 2rem' }}>
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 text-sm font-medium text-zinc-400 hover:text-white bg-transparent border border-zinc-700 rounded-lg px-3 py-1.5 transition-colors"
        >
          ← Back
        </button>

        {/* ── VIDEO PLAYER ── */}
        <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', background: '#000', marginBottom: '1.5rem', border: '1px solid rgba(139,92,246,0.2)' }}>

          {streamURL ? (
            <video
              ref={videoRef}
              src={streamURL}
              style={{ width: '100%', display: 'block', maxHeight: '500px', objectFit: 'contain', background: '#000' }}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          ) : (
            <div style={{ width: '100%', height: '360px', background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.1))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <span style={{ fontSize: '3rem' }}>🎬</span>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', margin: 0 }}>Video file not yet available</p>
            </div>
          )}

          {/* Duration overlay — top right */}
          <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', borderRadius: '6px', padding: '4px 10px', color: '#f9fafb', fontSize: '0.78rem', fontWeight: '600', border: '1px solid rgba(255,255,255,0.1)' }}>
            {formatDuration(duration)}
          </div>

          {/* Custom controls overlay */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)', padding: '16px' }}>
            {/* Progress bar */}
            <div
              onClick={handleSeek}
              style={{ height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', marginBottom: '10px', cursor: 'pointer' }}
            >
              <div style={{ height: '100%', borderRadius: '2px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899)', width: `${progress}%`, transition: 'width 0.1s linear' }} />
            </div>
            {/* Controls row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {streamURL && (
                <button onClick={togglePlay} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', fontSize: '1.2rem', padding: '2px', lineHeight: 1 }}>
                  {playing ? '⏸' : '▶'}
                </button>
              )}
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem' }}>
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </span>
            </div>
          </div>
        </div>

        {/* ── VIDEO INFO ── */}
        {videoMeta && (
          <>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: '800', fontSize: '1.5rem', color: '#f9fafb', margin: '0 0 10px' }}>
              {videoMeta.title}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg,#8b5cf6,#ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '700', color: 'white' }}>
                  {(videoMeta.owner?.username || videoMeta.uploader?.username || '?').charAt(0).toUpperCase()}
                </div>
                <span style={{ color: '#a78bfa', fontWeight: '600', fontSize: '0.875rem' }}>
                  @{videoMeta.owner?.username || videoMeta.uploader?.username || 'Unknown'}
                </span>
              </div>
              <span style={{ color: '#4b5563', fontSize: '0.78rem' }}>{new Date(videoMeta.createdAt).toLocaleDateString()}</span>
              {videoMeta.viewsCount != null && (
                <span style={{ color: '#4b5563', fontSize: '0.78rem' }}>👁 {videoMeta.viewsCount.toLocaleString()} views</span>
              )}
              {videoMeta.trendingScore > 0 && (
                <span style={{ padding: '2px 10px', borderRadius: '100px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontSize: '0.72rem', fontWeight: '600' }}>
                  🔥 {Math.round(videoMeta.trendingScore)}
                </span>
              )}
            </div>

            {videoMeta.description && (
              <p style={{ color: '#9ca3af', lineHeight: '1.7', marginBottom: '1.5rem', background: '#1a1a1a', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.9rem' }}>
                {videoMeta.description}
              </p>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '2rem', alignItems: 'center' }}>
              <LikeButton videoId={videoMeta._id} initialCount={likesCount} />
              <ShareButton videoId={videoMeta._id} />

              {/* Dynamic ownership: Edit and Delete only shown to owner OR admin */}
              {(isOwner || isAdmin) && (
                <>
                  <button style={{ padding: '8px 16px', borderRadius: '100px', cursor: 'pointer', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', fontSize: '0.875rem', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                    ✏️ Edit
                  </button>
                  <button style={{ padding: '8px 16px', borderRadius: '100px', cursor: 'pointer', background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.3)', color: '#ec4899', fontSize: '0.875rem', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                    🗑️ Delete
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '2rem' }} />

        {/* Review section */}
        <ReviewSection
          videoId={id}
          currentUserId={user?._id}
          currentUserRole={user?.role}
        />

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '2rem 0' }} />

        {/* Comment section */}
        <CommentSection videoId={id} currentUserId={user?._id} />
      </div>
    </div>
  );
}