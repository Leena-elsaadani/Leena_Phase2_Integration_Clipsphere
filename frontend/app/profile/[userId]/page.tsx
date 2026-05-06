'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../services/api';
import VideoCard from '../../../components/VideoCard';

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = useMemo(() => String(params?.userId || ''), [params]);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    api('/videos?limit=100&skip=0')
      .then((res) => {
        if (cancelled) return;
        const all = res?.data?.videos ?? [];
        const userVideos = all.filter((v: any) => {
          const ownerId = v?.owner?._id || v?.owner || v?.uploader?._id || v?.uploader;
          return String(ownerId) === String(userId);
        });
        setVideos(userVideos);
      })
      .catch(() => {
        if (!cancelled) setVideos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([api(`/users/${userId}/followers`), api(`/users/${userId}/following`)])
      .then(([followers, following]) => {
        if (cancelled) return;
        setFollowersCount(Array.isArray(followers) ? followers.length : 0);
        setFollowingCount(Array.isArray(following) ? following.length : 0);
      })
      .catch(() => {
        if (cancelled) return;
        setFollowersCount(0);
        setFollowingCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const username = videos[0]?.owner?.username || videos[0]?.uploader?.username || userId;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d', color: '#f9fafb', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.25rem' }}>
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 text-sm font-medium text-zinc-400 hover:text-white bg-transparent border border-zinc-700 rounded-lg px-3 py-1.5 transition-colors"
        >
          ← Back
        </button>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: '800', fontSize: '1.75rem', marginBottom: '1.25rem' }}>
          @{username}
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          Followers: {followersCount} · Following: {followingCount}
        </p>

        {loading && <p style={{ color: '#6b7280' }}>Loading profile...</p>}
        {!loading && videos.length === 0 && <p style={{ color: '#6b7280' }}>No uploaded videos yet.</p>}

        {!loading && videos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8">
            {videos.map((video) => (
              <VideoCard key={video._id} video={video} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
