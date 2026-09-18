"use client";

import { useRef, useState, useTransition } from "react";
import { importCsv } from "./actions";
import type { ImportSummary } from "@/lib/imports/registry";
import { Card, CardContent } from "@/components/ui/card";

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
    <Card className="border-line shadow-none">
      <CardContent className="p-5">
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
        {pending && <p className="mt-3 text-xs text-stone">Importing{fileName ? ` ${fileName}` : ""}…</p>}
        {result && "summary" in result && (
          <div className="mt-4 text-sm">
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
                <p className="label-caps mb-1 text-stone">
                  {result.summary.errors.length} note{result.summary.errors.length === 1 ? "" : "s"}
                </p>
                <ul className="max-h-64 list-disc space-y-0.5 overflow-y-auto pl-4 text-xs text-accent">
                  {result.summary.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {result && "error" in result && <p className="mt-3 text-sm text-accent">{result.error}</p>}
      </CardContent>
    </Card>
  );
}
