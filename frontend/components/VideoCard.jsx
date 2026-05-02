"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function formatDuration(secs) {
  if (!secs && secs !== 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatViews(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function VideoCard({ video }) {
  const creator = video.uploader ?? video.owner;
  const viewCount = video.views ?? video.viewsCount ?? 0;

  const minioBaseUrl = process.env.NEXT_PUBLIC_MINIO_PUBLIC_URL || "http://localhost:9000/videos";
  
  const getThumbnailUrl = () => {
    if (!video.thumbnailKey) return null;
    const cleanBase = minioBaseUrl.replace(/\/+$/, "");
    const cleanKey = String(video.thumbnailKey).replace(/^\/+/, "").replace(/^thumbnails\//i, "");
    // thumbnails are in a separate path
    const base = cleanBase.replace(/\/videos$/i, "");
    return `${base}/videos/thumbnails/${cleanKey}`;
  };

  const thumbnailSrc = getThumbnailUrl();

  const videoElRef = useRef(null);
  const [hovering, setHovering] = useState(false);
  const [imgError, setImgError] = useState(false);
  const hoverTimerRef = useRef(null);

  const minioBase = minioBaseUrl.replace(/\/+$/, "");
  const previewSrc = video.videoKey
    ? `${minioBase}/${String(video.videoKey).replace(/^\/+/, "")}`
    : null;

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    };
  }, []);

  if (!globalThis.__clipsphereHoverPlay) {
    globalThis.__clipsphereHoverPlay = { current: null };
  }
  const hoverPlayState = globalThis.__clipsphereHoverPlay;

  const startHover = () => {
    setHovering(true);
    if (!previewSrc || !videoElRef.current) return;
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      const el = videoElRef.current;
      if (!el) return;
      if (hoverPlayState.current && hoverPlayState.current !== el) {
        try { hoverPlayState.current.pause(); } catch (_) {}
      }
      hoverPlayState.current = el;
      el.muted = true;
      el.playsInline = true;
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }, 120);
  };

  const endHover = () => {
    setHovering(false);
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    if (videoElRef.current) {
      try {
        videoElRef.current.pause();
        videoElRef.current.currentTime = 0;
      } catch (_) {}
    }
  };

  const creatorInitial = creator?.username?.[0]?.toUpperCase() ?? '?';

  return (
    <Link
      href={`/watch/${video._id}`}
      className="group block"
      onMouseEnter={startHover}
      onMouseLeave={endHover}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-zinc-900 rounded-xl overflow-hidden">
        {/* Gradient placeholder — always shown as background */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.2))`,
          }}
        />

        {/* Thumbnail image — only if we have a URL and no error */}
        {thumbnailSrc && !imgError && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailSrc}
            alt={video.title}
            onError={() => setImgError(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 ${hovering ? "scale-105" : ""}`}
          />
        )}

        {/* Hover preview video */}
        {previewSrc && (
          <video
            ref={videoElRef}
            src={previewSrc}
            preload="none"
            muted
            playsInline
            loop
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-150 ${
              hovering ? "opacity-100" : "opacity-0"
            } hidden md:block`}
          />
        )}

        {/* Play overlay on hover */}
        {hovering && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)',
              border: '2px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: 'white', fontSize: '1.1rem', marginLeft: '3px' }}>▶</span>
            </div>
          </div>
        )}

        {/* Duration badge */}
        <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-mono px-1.5 py-0.5 rounded">
          {formatDuration(video.duration)}
        </span>
      </div>

      {/* Meta */}
      <div className="mt-2 flex gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white text-sm font-bold uppercase">
          {creatorInitial}
        </div>

        <div className="overflow-hidden">
          <p className="text-sm font-semibold text-white line-clamp-2 leading-tight group-hover:text-violet-400 transition-colors">
            {video.title}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {creator?.username ?? "Unknown"}
          </p>
          <p className="text-xs text-zinc-500">
            {formatViews(viewCount)} views · {timeAgo(video.createdAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}