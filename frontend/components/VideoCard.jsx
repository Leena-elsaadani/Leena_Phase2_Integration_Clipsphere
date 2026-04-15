/**
 * components/VideoCard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays a single video thumbnail + metadata in the feed grid.
 */
"use client";

import Image from "next/image";
import Link from "next/link";

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
  const thumbnailSrc =
    video.thumbnailKey
      ? `${process.env.NEXT_PUBLIC_MINIO_PUBLIC_URL}/videos/${video.thumbnailKey}`
      : "/placeholder-thumbnail.svg";

  return (
    <Link href={`/watch/${video._id}`} className="group block">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-zinc-900 rounded-xl overflow-hidden">
        <Image
          src={thumbnailSrc}
          alt={video.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {/* Duration badge */}
        <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-mono px-1.5 py-0.5 rounded">
          {formatDuration(video.duration)}
        </span>
      </div>

      {/* Meta */}
      <div className="mt-2 flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white text-sm font-bold uppercase">
          {video.uploader?.username?.[0] ?? "?"}
        </div>

        <div className="overflow-hidden">
          <p className="text-sm font-semibold text-white line-clamp-2 leading-tight group-hover:text-violet-400 transition-colors">
            {video.title}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {video.uploader?.username ?? "Unknown"}
          </p>
          <p className="text-xs text-zinc-500">
            {formatViews(video.views)} views · {timeAgo(video.createdAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}