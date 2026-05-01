/**
 * components/VideoCard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays a single video thumbnail + metadata in the feed grid.
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function formatDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatViews(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(dateStr) {
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

  const minioBaseUrl = process.env.NEXT_PUBLIC_MINIO_PUBLIC_URL || "";
  const thumbnailSrc =
    video.thumbnailKey && minioBaseUrl
      ? `${minioBaseUrl}/${video.thumbnailKey}`
      : "/placeholder-thumbnail.svg";

  // Hover-to-play (desktop): keep at most one card playing globally.
  // This is module-scoped so it works across many cards without extra state management.
  const videoElRef = useRef(null);
  const [hovering, setHovering] = useState(false);
  const hoverTimerRef = useRef(null);

  const previewSrc =
    video.videoKey && minioBaseUrl ? `${minioBaseUrl}/${video.videoKey}` : null;

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // eslint-disable-next-line no-undef
  if (!globalThis.__clipsphereHoverPlay) {
    // eslint-disable-next-line no-undef
    globalThis.__clipsphereHoverPlay = { current: null };
  }
  // eslint-disable-next-line no-undef
  const hoverPlayState = globalThis.__clipsphereHoverPlay;

  const startHover = () => {
    setHovering(true);
    if (!previewSrc || !videoElRef.current) return;
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      const el = videoElRef.current;
      if (!el) return;
      // Pause any other preview
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

  return (
    <Link
      href={`/watch/${video._id}`}
      className="group block"
      onMouseEnter={startHover}
      onMouseLeave={endHover}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-zinc-900 rounded-xl overflow-hidden">
        {/* Still thumbnail */}
        <Image
          src={thumbnailSrc}
          alt={video.title}
          fill
          className={`object-cover transition-transform duration-300 ${hovering ? "scale-105" : ""}`}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />

        {/* Hover preview video (desktop only; hidden on touch devices) */}
        {previewSrc && (
          <video
            ref={videoElRef}
            src={previewSrc}
            poster={thumbnailSrc}
            preload="metadata"
            muted
            playsInline
            loop
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-150 ${
              hovering ? "opacity-100" : "opacity-0"
            } hidden md:block`}
          />
        )}

        {/* Duration badge */}
        <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-mono px-1.5 py-0.5 rounded">
          {formatDuration(video.duration)}
        </span>
      </div>

      {/* Meta */}
      <div className="mt-2 flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white text-sm font-bold uppercase">
          {creator?.username?.[0] ?? "?"}
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