/**
 * lib/api.js
 * Thin fetch wrapper that prepends NEXT_PUBLIC_API_URL.
 * Backend uses an httpOnly `token` cookie for auth.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

async function request(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const msg = data?.message || data?.errors?.[0]?.message || `Request failed: ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

export const videoApi = {
  getFeed: (limit = 10, skip = 0) =>
    request(`/videos?limit=${limit}&skip=${skip}`),

  getFollowingFeed: (limit = 10, skip = 0) =>
    request(`/videos/following?limit=${limit}&skip=${skip}`),

  getTrendingFeed: (limit = 10, skip = 0) =>
    request(`/videos/trending?limit=${limit}&skip=${skip}`),

  getStreamURL: (id) => request(`/videos/${id}/stream-url`),

  uploadVideo: (formData, onProgress) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE}/videos/upload`);
      xhr.withCredentials = true;

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