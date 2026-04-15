/**
 * app/upload/page.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Video upload page:
 *   - Drag & drop OR file picker
 *   - Client-side video preview (URL.createObjectURL)
 *   - Animated upload progress bar
 *   - Form fields: title, description, tags, visibility
 *   - Calls videoApi.uploadVideo() with XHR for progress events
 *   - Error / success feedback
 */
"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { videoApi } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function UploadPage() {
  const router = useRouter();

  // ── File state ──────────────────────────────────────────────────────────────
  const [file, setFile] = useState(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState("public");

  // ── Upload state ────────────────────────────────────────────────────────────
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // ── File selection ───────────────────────────────────────────────────────────
  const handleFile = useCallback((f) => {
    if (!f) return;
    if (f.type !== "video/mp4") {
      setError("Only MP4 files are supported.");
      return;
    }
    setError(null);
    setFile(f);
    // Revoke previous object URL to avoid memory leaks
    if (previewURL) URL.revokeObjectURL(previewURL);
    setPreviewURL(URL.createObjectURL(f));
  }, [previewURL]);

  const onFileChange = (e) => handleFile(e.target.files?.[0]);

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError("Please select a video file.");
    if (!title.trim()) return setError("Title is required.");

    setError(null);
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("tags", tags.trim());
    formData.append("visibility", visibility);

    try {
      await videoApi.uploadVideo(formData, setProgress);
      setSuccess(true);
      setTimeout(() => router.push("/"), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (success) {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl">🎉</div>
          <h2 className="text-2xl font-bold text-white">Upload successful!</h2>
          <p className="text-zinc-400">Redirecting to your feed…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight">
            Upload a <span className="text-violet-400">Video</span>
          </h1>
          <p className="text-zinc-400 mt-1 text-sm">MP4 only · Max 200 MB · Max 5 minutes</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Drop zone ── */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-colors duration-200 flex flex-col items-center justify-center py-14 gap-3 ${
              isDragging
                ? "border-violet-500 bg-violet-500/10"
                : file
                ? "border-green-500 bg-green-500/5"
                : "border-zinc-700 hover:border-violet-500 bg-zinc-900 hover:bg-zinc-800/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4"
              className="sr-only"
              onChange={onFileChange}
            />
            {file ? (
              <>
                <span className="text-3xl">✅</span>
                <p className="font-semibold text-green-400">{file.name}</p>
                <p className="text-xs text-zinc-500">{formatBytes(file.size)}</p>
                <p className="text-xs text-zinc-600">Click to change</p>
              </>
            ) : (
              <>
                <span className="text-4xl">🎬</span>
                <p className="font-semibold">Drag & drop your MP4 here</p>
                <p className="text-sm text-zinc-500">or click to browse</p>
              </>
            )}
          </div>

          {/* ── Preview ── */}
          {previewURL && (
            <div className="rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
              <p className="text-xs text-zinc-500 px-3 py-1.5 border-b border-zinc-800">
                Preview
              </p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src={previewURL}
                controls
                className="w-full max-h-72 object-contain bg-black"
              />
            </div>
          )}

          {/* ── Progress bar ── */}
          {uploading && (
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Uploading…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* ── Title ── */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Give your video a catchy title"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              required
            />
          </div>

          {/* ── Description ── */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Tell viewers about your video…"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
            />
          </div>

          {/* ── Tags ── */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Tags <span className="text-zinc-500 font-normal">(comma separated)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="gaming, tutorial, music"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* ── Visibility ── */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Visibility
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="public">🌍 Public</option>
              <option value="unlisted">🔗 Unlisted</option>
              <option value="private">🔒 Private</option>
            </select>
          </div>

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={uploading}
            className="w-full py-3 rounded-xl font-bold text-white bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {uploading ? `Uploading… ${progress}%` : "Upload Video"}
          </button>
        </form>
      </div>
    </main>
  );
}