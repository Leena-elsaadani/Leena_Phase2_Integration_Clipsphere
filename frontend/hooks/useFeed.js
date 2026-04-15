/**
 * hooks/useFeed.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Custom hook for infinite-scroll paginated video feeds.
 * Supports three tabs: "public" | "following" | "trending"
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { videoApi } from "@/lib/api";

const LIMIT = 10;

const fetchers = {
  public: videoApi.getFeed,
  following: videoApi.getFollowingFeed,
  trending: videoApi.getTrendingFeed,
};

export function useFeed(tab = "public") {
  const [videos, setVideos] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const skipRef = useRef(0);
  const hasMore = videos.length < total || total === 0;

  // Reset when tab changes
  useEffect(() => {
    setVideos([]);
    setTotal(0);
    skipRef.current = 0;
    setError(null);
  }, [tab]);

  const loadMore = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const fetcher = fetchers[tab] || fetchers.public;
      const res = await fetcher(LIMIT, skipRef.current);
      const newVideos = res.data.videos;
      setVideos((prev) => {
        // De-duplicate by _id
        const ids = new Set(prev.map((v) => v._id));
        return [...prev, ...newVideos.filter((v) => !ids.has(v._id))];
      });
      setTotal(res.data.total);
      skipRef.current += newVideos.length;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tab, loading]);

  // Initial load when tab changes
  useEffect(() => {
    // Only load if videos array is empty (was reset)
    if (videos.length === 0 && !loading) {
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const hasMoreVideos = skipRef.current < total || total === 0 && loading;

  return {
    videos,
    total,
    loading,
    error,
    loadMore,
    hasMore: skipRef.current < total || (total === 0 && loading),
  };
}