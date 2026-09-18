"use client";

import { useRef, useState } from "react";

// Vercel enforces a hard, non-configurable 4.5MB request-body limit on
// every serverless function (see /api/admin/upload) — a platform ceiling,
// not something our own code or plan can raise. When a request goes over
// it, Vercel rejects the request itself, before our route ever runs, with
// a plain-text "Request Entity Too Large" page instead of JSON — which is
// what used to surface as a raw "Unexpected token 'R' ... is not valid
// JSON" error (see parseUploadResponse() below, which is the safety net
// for that). SAFE_TARGET_BYTES (4MB) leaves real headroom under that
// 4.5MB hard limit for multipart form overhead.
const SAFE_TARGET_BYTES = 4 * 1024 * 1024;
const RESIZE_IF_OVER_BYTES = 2 * 1024 * 1024;

// Progressively smaller/lower-quality passes, tried in order until one
// lands under SAFE_TARGET_BYTES. A single resize pass isn't always enough:
// photos of art prints are full of fine texture and detail, which JPEG/WebP
// compress far less efficiently than a typical photo (sky, skin, etc), so
// a detailed print photo can still be several MB after one pass.
const COMPRESSION_STEPS = [
  { maxDimension: 2400, quality: 0.85 },
  { maxDimension: 2000, quality: 0.75 },
  { maxDimension: 1600, quality: 0.65 },
  { maxDimension: 1200, quality: 0.5 },
];

async function canvasToBlob(
  img: HTMLImageElement,
  maxDimension: number,
  quality: number,
  outputType: string
): Promise<Blob | null> {
  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, outputType, outputType === "image/png" ? undefined : quality));
}

/** Downscales/recompresses a large photo before upload, trying
 * progressively smaller/lower-quality passes until the result comfortably
 * fits under Vercel's hard request-body limit. Animated GIFs are left
 * untouched (re-encoding one through <canvas> would flatten it to a single
 * frame) and anything already reasonably sized is left alone too, so this
 * never trades away quality that wasn't needed. If every pass still comes
 * out too big (rare — an extremely detailed PNG with transparency), the
 * last resort drops transparency and re-encodes as JPEG rather than
 * uploading something that's guaranteed to fail; any other hiccup along
 * the way just falls back to the original file (parseUploadResponse() in
 * upload() below is the safety net if that original still turns out too
 * big for the server to accept). */
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

    const preferredType = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
    let best: File | null = null;

    for (const step of COMPRESSION_STEPS) {
      const blob = await canvasToBlob(img, step.maxDimension, step.quality, preferredType);
      if (!blob) continue;
      const candidate = new File([blob], file.name, { type: preferredType });
      if (!best || candidate.size < best.size) best = candidate;
      if (blob.size <= SAFE_TARGET_BYTES) return candidate;
    }

    // PNG has no quality knob to turn down, so a large, detailed,
    // transparent PNG can still be too big after every dimension step
    // above — as an absolute last resort, drop transparency and re-encode
    // the smallest attempt as JPEG.
    if (preferredType === "image/png" && (!best || best.size > SAFE_TARGET_BYTES)) {
      const smallest = COMPRESSION_STEPS[COMPRESSION_STEPS.length - 1];
      const blob = await canvasToBlob(img, smallest.maxDimension, 0.6, "image/jpeg");
      if (blob && (!best || blob.size < best.size)) {
        best = new File([blob], file.name.replace(/\.png$/i, ".jpg"), { type: "image/jpeg" });
      }
    }

    return best ?? file;
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
