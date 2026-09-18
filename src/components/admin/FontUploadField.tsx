"use client";

import { useRef, useState } from "react";

/** Reads an upload response defensively — see ImageDropzone.tsx's copy of
 * this for why: the server (or the host, before our code even runs) can
 * reply with plain text instead of JSON, most often on an oversized file. */
async function parseUploadResponse(res: Response): Promise<{ url?: string; format?: string; error?: string }> {
  try {
    return await res.json();
  } catch {
    if (res.status === 413) {
      return { error: "That file is too large for the server to accept — try a smaller one." };
    }
    return { error: `Upload failed (${res.status}). Please try again.` };
  }
}

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
      const data = await parseUploadResponse(res);
      if (!res.ok || !data.url || !data.format) throw new Error(data.error || "Upload failed.");
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
