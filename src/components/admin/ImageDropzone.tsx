"use client";

import { useRef, useState } from "react";

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
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
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
