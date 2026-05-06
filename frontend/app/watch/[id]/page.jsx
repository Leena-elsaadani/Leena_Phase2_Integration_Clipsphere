'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const wheelAccRef = useRef(0);
  const wheelLockRef = useRef(false);
  const touchStartYRef = useRef(null);
  const playerRegionRef = useRef(null);
  const viewTrackedRef = useRef(new Set());

  const [streamURL, setStreamURL] = useState(null);
  const [streamError, setStreamError] = useState(null);
  const [videoMeta, setVideoMeta] = useState(null);
  const [stack, setStack] = useState({ videos: [], index: 0 });

  const [likesCount, setLikesCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [creatorFollowersCount, setCreatorFollowersCount] = useState(0);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [aspect, setAspect] = useState(null);
  const [viewCount, setViewCount] = useState(0);

  useEffect(() => {
    if (!id) return;

    async function fetchAll() {
      setLoading(true);
      setError(null);
      setStreamURL(null);
      setStreamError(null);
      setVideoMeta(null);
      setLikesCount(0);
      setLikedByMe(false);
      setAspect(null);

      // 1) Load stack
      try {
        const stackRes = await api(`/videos/${id}/stack?before=2&after=2`);
        const videos = stackRes?.data?.videos || [];
        const index = stackRes?.data?.index ?? 0;
        setStack({ videos, index });
        const current = videos[index] ?? null;
        setVideoMeta(current);
        setViewCount(current?.viewsCount ?? 0);
      } catch (err) {
        // Try direct fetch as fallback
        try {
          const directRes = await api(`/videos?limit=100&skip=0`);
          const all = directRes?.data?.videos || [];
          const found = all.find(v => v._id === id);
          if (found) {
            setVideoMeta(found);
            setViewCount(found.viewsCount ?? 0);
            setStack({ videos: [found], index: 0 });
          } else {
            setError('Video not found');
          }
        } catch (e2) {
          setError(e2?.message || 'Failed to load video');
        }
      }

      // 2) Stream URL
      try {
        const streamRes = await videoApi.getStreamURL(id);
        const url = streamRes?.data?.url;
        if (url) {
          setStreamURL(url);
        } else {
          setStreamError('No stream URL returned');
        }
      } catch (e) {
        setStreamError(e?.message || 'Could not load video stream');
      }

      // 3) Likes
      try {
        const likesRes = await api(`/videos/${id}/likes`);
        setLikesCount(likesRes.data?.likesCount ?? 0);
      } catch {
        setLikesCount(0);
      }

      if (user) {
        try {
          const statusRes = await api(`/videos/${id}/likes/status`);
          setLikedByMe(Boolean(statusRes.data?.liked));
        } catch {
          setLikedByMe(false);
        }
      }

      setLoading(false);
    }

    fetchAll();
  }, [id, user?._id]);

  useEffect(() => {
    const targetId =
      videoMeta?.owner?._id ||
      videoMeta?.owner ||
      videoMeta?.uploader?._id ||
      videoMeta?.uploader;
    if (!user?._id || !targetId || String(user._id) === String(targetId)) {
      setIsFollowing(false);
      return;
    }

    let cancelled = false;
    api(`/users/${targetId}/followers`)
      .then((followers) => {
        if (cancelled) return;
        const list = Array.isArray(followers) ? followers : [];
        setIsFollowing(list.some((f) => String(f?._id) === String(user._id)));
        setCreatorFollowersCount(list.length);
      })
      .catch(() => {
        if (!cancelled) {
          setIsFollowing(false);
          setCreatorFollowersCount(0);
        }
      });
    return () => { cancelled = true; };
  }, [videoMeta, user]);

  useEffect(() => {
    if (!videoMeta) return;
    setEditTitle(videoMeta.title || '');
    setEditDesc(videoMeta.description || '');
  }, [videoMeta]);

  const handleEditSave = async () => {
    if (!id || !editTitle.trim()) {
      alert('Title cannot be empty');
      return;
    }
    setEditLoading(true);
    try {
      const res = await api(`/videos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: editTitle.trim(), description: editDesc.trim() }),
      });
      setVideoMeta(res?.data?.data ?? null);
      setEditMode(false);
    } catch (err) {
      alert(`Edit failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleteLoading(true);
    try {
      await api(`/videos/${id}`, { method: 'DELETE' });
      router.push('/feed');
    } catch (err) {
      alert(`Delete failed: ${err?.message || 'Unknown error'}`);
      setDeleteConfirm(false);
    } finally {
      setDeleteLoading(false);
    }
  };

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

  const objectFit = useMemo(() => {
    if (!aspect) return 'contain';
    if (aspect < 0.9) return 'cover';
    return 'contain';
  }, [aspect]);

  const currentIndex = stack.index ?? 0;
  const currentStackVideos = stack.videos || [];

  const goRelative = (delta) => {
    const nextIndex = currentIndex + delta;
    const next = currentStackVideos[nextIndex];
    if (!next?._id) return;
    router.replace(`/watch/${next._id}`);
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goRelative(1); }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goRelative(-1); }
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentIndex, currentStackVideos]);

  const onWheel = (e) => {
    e.preventDefault();
    if (wheelLockRef.current) return;
    wheelAccRef.current += e.deltaY;
    if (Math.abs(wheelAccRef.current) < 70) return;
    const dir = wheelAccRef.current > 0 ? 1 : -1;
    wheelAccRef.current = 0;
    wheelLockRef.current = true;
    goRelative(dir);
    window.setTimeout(() => { wheelLockRef.current = false; }, 450);
  };

  useEffect(() => {
    const el = playerRegionRef.current;
    if (!el) return;
    const handler = (e) => onWheel(e);
    const onTouchMove = (e) => { e.preventDefault(); };
    el.addEventListener('wheel', handler, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('wheel', handler);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [currentIndex, currentStackVideos]);

  const onTouchStart = (e) => {
    const y = e.touches?.[0]?.clientY;
    if (typeof y === 'number') touchStartYRef.current = y;
  };
  const onTouchEnd = (e) => {
    const startY = touchStartYRef.current;
    touchStartYRef.current = null;
    if (typeof startY !== 'number') return;
    const endY = e.changedTouches?.[0]?.clientY;
    if (typeof endY !== 'number') return;
    const dy = endY - startY;
    if (Math.abs(dy) < 55) return;
    goRelative(dy < 0 ? 1 : -1);
  };

  const ownerId =
    videoMeta?.owner?._id ||
    videoMeta?.owner ||
    videoMeta?.uploader?._id ||
    videoMeta?.uploader;
  const isOwner = user && ownerId && String(user._id) === String(ownerId);
  const isAdmin = user?.role === 'admin';
  const creatorUsername = videoMeta?.owner?.username || videoMeta?.uploader?.username || 'Unknown';

  const handleFollowToggle = async () => {
    if (!user || !ownerId || String(user._id) === String(ownerId) || followLoading) return;
    setFollowLoading(true);
    try {
      await api(`/users/${ownerId}/follow`, { method: isFollowing ? 'DELETE' : 'POST' });
      setIsFollowing((prev) => {
        const next = !prev;
        setCreatorFollowersCount((c) => Math.max(0, c + (next ? 1 : -1)));
        return next;
      });
    } catch (err) {
      alert(err?.message || 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

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

      <div style={{ maxWidth: '980px', margin: '0 auto', padding: '1rem 1rem 2rem' }}>
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 text-sm font-medium text-zinc-400 hover:text-white bg-transparent border border-zinc-700 rounded-lg px-3 py-1.5 transition-colors"
        >
          ← Back
        </button>

        {/* PLAYER */}
        <div
          ref={playerRegionRef}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{
            position: 'relative',
            borderRadius: '16px',
            overflow: 'hidden',
            background: '#000',
            marginBottom: '1.5rem',
            border: '1px solid rgba(139,92,246,0.2)',
            height: 'min(78vh, 560px)',
            touchAction: 'none',
          }}
        >
          {streamURL ? (
            <video
              ref={videoRef}
              src={streamURL}
              playsInline
              controls
              preload="metadata"
              style={{ width: '100%', height: '100%', display: 'block', objectFit, background: '#000' }}
              onLoadedMetadata={(e) => {
                const vw = e.currentTarget.videoWidth;
                const vh = e.currentTarget.videoHeight;
                if (vw && vh) setAspect(vw / vh);
              }}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setPlaying(false)}
              onPlay={async () => {
                setPlaying(true);
                if (!id || viewTrackedRef.current.has(String(id))) return;
                viewTrackedRef.current.add(String(id));
                try {
                  const res = await api(`/videos/${id}/view`, { method: 'POST' });
                  const nextViews = res?.data?.viewsCount;
                  if (typeof nextViews === 'number') setViewCount(nextViews);
                } catch { /* ignore */ }
              }}
              onPause={() => setPlaying(false)}
              onError={(e) => {
                console.error('Video error:', e);
                setStreamError('Failed to play video. The URL may have expired — refresh the page.');
              }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.1))',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px'
            }}>
              <span style={{ fontSize: '3rem' }}>🎬</span>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', margin: 0, textAlign: 'center', padding: '0 16px' }}>
                {!user
                  ? 'Please log in to watch videos'
                  : streamError
                  ? streamError
                  : 'Loading video...'}
              </p>
              {!user && (
                <a href="/login" style={{ color: '#a78bfa', textDecoration: 'underline', fontSize: '0.875rem' }}>
                  Log in
                </a>
              )}
            </div>
          )}

          {/* Duration overlay */}
          <div style={{
            position: 'absolute', top: '12px', right: '12px',
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
            borderRadius: '6px', padding: '4px 10px',
            color: '#f9fafb', fontSize: '0.78rem', fontWeight: '600',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {formatDuration(duration)}
          </div>

          {/* Nav hints */}
          <div style={{ position: 'absolute', left: '12px', top: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '6px 10px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)' }}>
              Scroll / ↑↓ / swipe
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => goRelative(-1)}
                disabled={currentIndex <= 0}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', borderRadius: '10px', padding: '6px 10px', fontSize: '0.75rem', cursor: currentIndex <= 0 ? 'not-allowed' : 'pointer', opacity: currentIndex <= 0 ? 0.5 : 1 }}
              >↑ Prev</button>
              <button
                type="button"
                onClick={() => goRelative(1)}
                disabled={currentIndex >= currentStackVideos.length - 1}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', borderRadius: '10px', padding: '6px 10px', fontSize: '0.75rem', cursor: currentIndex >= currentStackVideos.length - 1 ? 'not-allowed' : 'pointer', opacity: currentIndex >= currentStackVideos.length - 1 ? 0.5 : 1 }}
              >↓ Next</button>
            </div>
          </div>

          {/* Progress bar overlay */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)', padding: '16px' }}>
            <div onClick={handleSeek} style={{ height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', marginBottom: '10px', cursor: 'pointer' }}>
              <div style={{ height: '100%', borderRadius: '2px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899)', width: `${progress}%`, transition: 'width 0.1s linear' }} />
            </div>
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

        {/* VIDEO INFO */}
        {videoMeta && (
          <>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: '800', fontSize: '1.5rem', color: '#f9fafb', margin: '0 0 10px' }}>
              {videoMeta.title}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg,#8b5cf6,#ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '700', color: 'white' }}>
                  {creatorUsername.charAt(0).toUpperCase()}
                </div>
                {ownerId ? (
                  <a href={`/profile/${ownerId}`} style={{ color: '#a78bfa', fontWeight: '600', fontSize: '0.875rem', textDecoration: 'none' }}>
                    @{creatorUsername}
                  </a>
                ) : (
                  <span style={{ color: '#a78bfa', fontWeight: '600', fontSize: '0.875rem' }}>@{creatorUsername}</span>
                )}
              </div>
              <span style={{ color: '#4b5563', fontSize: '0.78rem' }}>{videoMeta.createdAt ? new Date(videoMeta.createdAt).toLocaleDateString() : ''}</span>
              {typeof viewCount === 'number' && (
                <span style={{ color: '#4b5563', fontSize: '0.78rem' }}>👁 {viewCount.toLocaleString()} views</span>
              )}
              {videoMeta.trendingScore > 0 && (
                <span style={{ padding: '2px 10px', borderRadius: '100px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontSize: '0.72rem', fontWeight: '600' }}>
                  🔥 {Math.round(videoMeta.trendingScore)}
                </span>
              )}
              {user && ownerId && String(user._id) !== String(ownerId) && (
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  style={{ padding: '4px 10px', borderRadius: '100px', border: '1px solid rgba(139,92,246,0.4)', background: isFollowing ? 'rgba(139,92,246,0.2)' : 'transparent', color: '#c4b5fd', fontSize: '0.75rem', fontWeight: '600', cursor: followLoading ? 'not-allowed' : 'pointer' }}
                >
                  {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
              {creatorFollowersCount > 0 && (
                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Followers: {creatorFollowersCount}</span>
              )}
            </div>

            {videoMeta.description && (
              <p style={{ color: '#9ca3af', lineHeight: '1.7', marginBottom: '1.5rem', background: '#1a1a1a', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.9rem' }}>
                {videoMeta.description}
              </p>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '2rem', alignItems: 'center' }}>
              <LikeButton videoId={videoMeta._id} initialCount={likesCount} initialLiked={likedByMe} />
              <ShareButton videoId={videoMeta._id} />

              {(isOwner || isAdmin) && (
                <>
                  <button
                    onClick={() => setEditMode(true)}
                    disabled={editLoading || deleteLoading}
                    style={{ padding: '8px 16px', borderRadius: '100px', cursor: 'pointer', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', fontSize: '0.875rem', fontWeight: '600' }}
                  >✏️ Edit</button>
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    disabled={editLoading || deleteLoading}
                    style={{ padding: '8px 16px', borderRadius: '100px', cursor: 'pointer', background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.3)', color: '#ec4899', fontSize: '0.875rem', fontWeight: '600' }}
                  >🗑️ Delete</button>
                </>
              )}
            </div>

            {/* Edit modal */}
            {editMode && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                <div style={{ background: '#1a1a1a', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '2rem', maxWidth: '520px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                  <h3 style={{ marginTop: 0, color: '#f9fafb' }}>Edit Video</h3>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Title"
                    style={{ width: '100%', marginBottom: '10px', padding: '8px', background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#f9fafb', boxSizing: 'border-box' }}
                  />
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Description"
                    style={{ width: '100%', marginBottom: '10px', padding: '8px', background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#f9fafb', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditMode(false)} disabled={editLoading} style={{ padding: '8px 16px', background: '#4b5563', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleEditSave} disabled={editLoading} style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: editLoading ? 'not-allowed' : 'pointer' }}>
                      {editLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete confirmation */}
            {deleteConfirm && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                <div style={{ background: '#1a1a1a', border: '1px solid rgba(236,72,153,0.2)', borderRadius: '12px', padding: '2rem', maxWidth: '420px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                  <h3 style={{ marginTop: 0, color: '#f9fafb' }}>Delete Video?</h3>
                  <p style={{ color: '#9ca3af' }}>This action cannot be undone. Are you sure?</p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setDeleteConfirm(false)} disabled={deleteLoading} style={{ padding: '8px 16px', background: '#4b5563', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleDelete} disabled={deleteLoading} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: deleteLoading ? 'not-allowed' : 'pointer' }}>
                      {deleteLoading ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '2rem' }} />

        <ReviewSection videoId={id} currentUserId={user?._id} currentUserRole={user?.role} />

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '2rem 0' }} />

        <CommentSection videoId={id} currentUserId={user?._id} />
      </div>
    </div>
  );
}