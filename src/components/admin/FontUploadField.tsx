"use client";

import { useRef, useState } from "react";

/** A plain file picker for uploading a licensed font file (.woff2/.woff/
 * .ttf/.otf) — see /api/admin/upload-font. Modeled on ImageDropzone.tsx,
 * minus the drag-and-drop and image preview (a font file has nothing
 * sensible to preview until it has a name to test with — see
 * CustomFontsManager.tsx, which shows sample text in it once uploaded). */
export function FontUploadField({
  onUploaded,
}: {
  onUploaded: (result: { url: string; format: string }) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload-font", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      onUploaded({ url: data.url, format: data.format });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed — please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".woff2,.woff,.ttf,.otf"
        disabled={uploading}
        onChange={(e) => handleFiles(e.target.files)}
        className="text-sm"
      />
      {uploading && <p className="text-xs text-stone mt-1">Uploading…</p>}
      {error && <p className="text-xs text-accent mt-1">{error}</p>}
    </div>
  );
}
