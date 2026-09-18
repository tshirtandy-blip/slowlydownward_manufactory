"use client";

import { useRef, useState, useTransition } from "react";
import { importRoyalMailRatesCsv } from "./actions";
import { Card, CardContent } from "@/components/ui/card";

/** Bulk-import for the Royal Mail price list — reads the chosen file to
 * text in the browser and hands it straight to the server action (see
 * actions.ts) rather than a multipart upload, since a price list is always
 * small plain text. This REPLACES the whole price list, same as saving the
 * manual table below does, so a re-upload is the normal way to update it
 * later too. */
export function RoyalMailRatesCsvImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ imported: number; errors: string[] } | { error: string } | null>(null);

  function handleFile(file: File) {
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      startTransition(async () => {
        const res = await importRoyalMailRatesCsv(text);
        if (res.ok) {
          setResult({ imported: res.imported, errors: res.errors });
        } else {
          setResult({ error: res.error });
        }
        // Reload so the manual table below reflects the freshly-imported rows.
        if (res.ok) window.location.reload();
      });
    };
    reader.readAsText(file);
  }

  return (
    <Card className="mb-8 border-line shadow-none">
      <CardContent className="p-4">
        <h3 className="label-caps mb-2">Bulk import from a spreadsheet</h3>
        <p className="mb-3 text-xs text-stone">
          Have a full price list already, e.g. exported from a spreadsheet? Upload a CSV with columns{" "}
          <code className="text-[11px]">country_code, service, max_weight_g, max_length_cm, max_width_cm,
          max_height_cm, price_gbp</code>{" "}
          — leave <code className="text-[11px]">country_code</code> blank for a catch-all row. This{" "}
          <strong>replaces</strong> the whole price list below, so a re-upload is also how you update it later.
        </p>
        <div className="flex flex-wrap items-center gap-4">
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
          <a href="/admin/settings/shipping/royal-mail-rates/template" className="text-xs text-stone underline hover:text-ink">
            Download example CSV
          </a>
          <a href="/admin/settings/shipping/royal-mail-rates/export" className="text-xs text-stone underline hover:text-ink">
            Download current price list
          </a>
        </div>
        {pending && <p className="mt-3 text-xs text-stone">Importing…</p>}
        {result && "imported" in result && (
          <div className="mt-3 text-xs">
            <p className="text-stone">Imported {result.imported} row{result.imported === 1 ? "" : "s"}. Reloading…</p>
            {result.errors.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-accent">
                {result.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {result.errors.length > 10 && <li>…and {result.errors.length - 10} more.</li>}
              </ul>
            )}
          </div>
        )}
        {result && "error" in result && <p className="mt-3 text-xs text-accent">{result.error}</p>}
      </CardContent>
    </Card>
  );
}
