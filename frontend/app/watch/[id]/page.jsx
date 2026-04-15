/**
 * app/watch/[id]/page.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Video watch page — fetches a presigned stream URL then plays the video.
 */
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { videoApi } from "@/lib/api";

export default function WatchPage() {
  const { id } = useParams();
  const router = useRouter();
  const [streamURL, setStreamURL] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchURL() {
      try {
        const res = await videoApi.getStreamURL(id);
        setStreamURL(res.data.url);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchURL();
  }, [id]);

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
        <button
          onClick={() => router.push("/")}
          className="text-sm text-zinc-400 hover:text-white underline"
        >
          ← Back to feed
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="text-sm text-zinc-400 hover:text-white mb-4 inline-flex items-center gap-1"
        >
          ← Back
        </button>

        {/* Video player */}
        <div className="rounded-2xl overflow-hidden bg-black aspect-video">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={streamURL}
            controls
            autoPlay
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}