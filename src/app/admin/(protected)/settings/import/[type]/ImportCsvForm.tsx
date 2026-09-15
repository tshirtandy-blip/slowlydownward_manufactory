"use client";

import { useRef, useState, useTransition } from "react";
import { importCsv } from "./actions";
import type { ImportSummary } from "@/lib/imports/registry";

/** Reads the chosen file to text in the browser and hands it straight to
 * the server action, the same way the existing Royal Mail rates importer
 * does (Admin > Settings > Shipping) — a spreadsheet export is always
 * small plain text, so there's no need for a real multipart upload. Unlike
 * that importer, this one is additive (creates/updates matching rows) —
 * it never wipes out existing data first. */
export function ImportCsvForm({ typeKey, typeLabel }: { typeKey: string; typeLabel: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ summary: ImportSummary } | { error: string } | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleFile(file: File) {
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      startTransition(async () => {
        const res = await importCsv(typeKey, text);
        if (res.ok) {
          setResult({ summary: res.summary });
        } else {
          setResult({ error: res.error });
        }
        if (fileRef.current) fileRef.current.value = "";
      });
    };
    reader.readAsText(file);
  }

  return (
    <div className="border hairline p-5">
      <h3 className="label-caps mb-3">Upload your {typeLabel.toLowerCase()} CSV</h3>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="text-sm"
      />
      {pending && <p className="text-xs text-stone mt-3">Importing{fileName ? ` ${fileName}` : ""}…</p>}
      {result && "summary" in result && (
        <div className="text-sm mt-4">
          <p>
            {result.summary.created > 0 && <span>{result.summary.created} created</span>}
            {typeof result.summary.updated === "number" && result.summary.updated > 0 && (
              <span>{result.summary.created > 0 ? ", " : ""}{result.summary.updated} updated</span>
            )}
            {typeof result.summary.skipped === "number" && result.summary.skipped > 0 && (
              <span>
                {result.summary.created > 0 || result.summary.updated ? ", " : ""}
                {result.summary.skipped} skipped
              </span>
            )}
            {result.summary.created === 0 && !result.summary.updated && !result.summary.skipped && "Nothing to import."}
            .
          </p>
          {result.summary.errors.length > 0 && (
            <div className="mt-2">
              <p className="label-caps text-stone mb-1">
                {result.summary.errors.length} note{result.summary.errors.length === 1 ? "" : "s"}
              </p>
              <ul className="text-xs text-accent list-disc pl-4 space-y-0.5 max-h-64 overflow-y-auto">
                {result.summary.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {result && "error" in result && <p className="text-sm text-accent mt-3">{result.error}</p>}
    </div>
  );
}
