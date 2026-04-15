'use client';

import { useState, useEffect, useRef } from 'react';
import VideoCard from '@/components/VideoCard';
import { useFeed } from '@/hooks/useFeed';

const TABS = [
  { key: 'public', label: 'All' },
  { key: 'following', label: 'Following' },
  { key: 'trending', label: '🔥 Trending' },
];

// ── Loading skeleton ──────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="aspect-video bg-zinc-800 rounded-xl" />
      <div className="mt-2 flex gap-3">
        <div className="w-9 h-9 rounded-full bg-zinc-700 flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 bg-zinc-700 rounded w-3/4" />
          <div className="h-3 bg-zinc-800 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <svg
        className="w-8 h-8 animate-spin text-violet-500"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v8H4z"
        />
      </svg>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FeedPage() {
  const [activeTab, setActiveTab] = useState('public');
  const { videos, loading, error, loadMore, hasMore } = useFeed(activeTab);

  // IntersectionObserver sentinel
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { rootMargin: '200px' } // start loading 200px before sentinel is visible
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24">

        {/* ── Page header ── */}
        <h1 className="text-3xl font-black tracking-tight mb-6">
          <span className="text-violet-400">Clip</span>Sphere
        </h1>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-8 bg-zinc-900 p-1 rounded-xl w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="mb-6 bg-red-900/40 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── Video grid ── */}
        {videos.length === 0 && !loading ? (
          <div className="text-center text-zinc-500 py-24">
            <p className="text-5xl mb-4">📭</p>
            <p className="text-lg font-medium">No videos yet.</p>
            {activeTab === 'following' && (
              <p className="text-sm mt-1">Follow some creators to see their videos here.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
            {videos.map((video) => (
              <VideoCard key={video._id} video={video} />
            ))}

            {/* Skeleton cards while loading first page */}
            {loading && videos.length === 0 &&
              Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Infinite scroll sentinel ── */}
        <div ref={sentinelRef} className="h-1" />

        {/* ── Spinner for subsequent loads ── */}
        {loading && videos.length > 0 && <Spinner />}

        {/* ── End of feed message ── */}
        {!hasMore && videos.length > 0 && !loading && (
          <p className="text-center text-zinc-600 text-sm mt-10">
            You've reached the end ✓
          </p>
        )}
      </div>
    </main>
  );
}
