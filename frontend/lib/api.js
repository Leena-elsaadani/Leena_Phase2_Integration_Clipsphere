/**
 * lib/api.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin fetch wrapper that prepends NEXT_PUBLIC_API_URL and attaches the JWT
 * from localStorage automatically.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Don't set Content-Type for FormData — browser sets it with the boundary
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || `Request failed: ${res.status}`);
  }

  return data;
}

// ── Video endpoints ───────────────────────────────────────────────────────────

export const videoApi = {
  /**
   * Paginated public feed
   * @param {number} limit
   * @param {number} skip
   */
  getFeed: (limit = 10, skip = 0) =>
    request(`/videos?limit=${limit}&skip=${skip}`),

  /** Paginated following feed (requires auth) */
  getFollowingFeed: (limit = 10, skip = 0) =>
    request(`/videos/following?limit=${limit}&skip=${skip}`),

  /** Paginated trending feed */
  getTrendingFeed: (limit = 10, skip = 0) =>
    request(`/videos/trending?limit=${limit}&skip=${skip}`),

  /** Get presigned stream URL for a video */
  getStreamURL: (id) => request(`/videos/${id}/stream-url`),

  /**
   * Upload a video with progress tracking via XMLHttpRequest.
   * @param {FormData} formData  - { video, title, description, tags, visibility }
   * @param {Function} onProgress - (percent: number) => void
   */
  uploadVideo: (formData, onProgress) =>
    new Promise((resolve, reject) => {
      const token = getToken();
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE}/videos/upload`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress?.(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener("load", () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 400) reject(new Error(data.message || "Upload failed"));
          else resolve(data);
        } catch {
          reject(new Error("Invalid server response"));
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
      xhr.send(formData);
    }),
};