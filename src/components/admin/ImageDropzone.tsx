"use client";

import { useRef, useState } from "react";

// Vercel (and most hosts) reject an oversized request body before our own
// code ever runs, with a plain-text "Request Entity Too Large" page rather
// than JSON — which is what used to surface as a raw
// "Unexpected token 'R' ... is not valid JSON" error. Shrinking large
// photos client-side, before they're ever sent, avoids hitting that limit
// in the first place for the vast majority of real camera/phone photos;
// parseUploadResponse() below is the safety net for whatever still gets
// through (an oversized GIF, a platform error, etc).
const MAX_DIMENSION = 2400;
const RESIZE_IF_OVER_BYTES = 3 * 1024 * 1024;
const JPEG_QUALITY = 0.85;

/** Downscales a large photo to a sane web size before upload. Animated GIFs
 * are left untouched — re-encoding one through <canvas> would flatten it to
 * a single frame — and anything already reasonably sized is left alone
 * too, so this never trades away quality that wasn't needed. Any hiccup
 * along the way just falls back to uploading the original file. */
async function resizeImageIfNeeded(file: File): Promise<File> {
  if (file.type === "image/gif") return file;
  if (file.size <= RESIZE_IF_OVER_BYTES) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Couldn't read that image."));
      el.src = objectUrl;
    });

    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    // Already small enough dimensionally — recompressing wouldn't reliably
    // shrink it further, so just upload it as-is.
    if (scale >= 1) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const outputType = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, outputType === "image/png" ? undefined : JPEG_QUALITY)
    );
    if (!blob) return file;

    return new File([blob], file.name, { type: outputType });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Reads an upload response defensively — the server (or the hosting
 * platform itself, before the server ever sees the request) doesn't always
 * respond with JSON, most commonly a plain-text "Request Entity Too Large"
 * page when a file is bigger than a single request is allowed to be. */
async function parseUploadResponse(res: Response): Promise<{ url?: string; error?: string }> {
  try {
    return await res.json();
  } catch {
    if (res.status === 413) {
      return { error: "That file is too large for the server to accept — try a smaller one." };
    }
    return { error: `Upload failed (${res.status}). Please try again.` };
  }
}

/** A drag-and-drop image picker used throughout the block editor. Uploads
 * straight to Supabase Storage via /api/admin/upload and hands back a public
 * URL — the admin never has to know or type a file path. A "paste a URL
 * instead" fallback stays available for images already hosted elsewhere. */
export function ImageDropzone({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const toSend = await resizeImageIfNeeded(file);
      const formData = new FormData();
      formData.append("file", toSend);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await parseUploadResponse(res);
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed.");
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed — please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) upload(file);
  }

  return (
    <div>
      {label && <label className="label-caps block mb-2">{label}</label>}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border border-line border-dashed p-4 text-center cursor-pointer transition-colors ${
          dragOver ? "border-ink bg-line/30" : "hover:border-ink"
        }`}
      >
        {value ? (
          <div className="flex items-center gap-4 text-left">
            {/* Plain <img> is fine for a small admin-only thumbnail preview. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="w-20 h-20 object-cover border border-line shrink-0" />
            <p className="text-sm text-stone">
              {uploading ? "Uploading…" : "Drop a new image here, or click to replace."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-stone">{uploading ? "Uploading…" : "Drag an image here, or click to choose one."}</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="text-xs text-accent mt-1">{error}</p>}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowUrlInput((v) => !v);
        }}
        className="text-xs text-stone hover:text-ink mt-2 underline"
      >
        {showUrlInput ? "Hide" : "Or paste an image URL instead"}
      </button>

      {showUrlInput && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className="border border-input bg-background px-3 py-2 text-sm w-full mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      )}
    </div>
  );
}
