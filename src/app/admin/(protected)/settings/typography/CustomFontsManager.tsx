"use client";

import { useState } from "react";
import { addCustomFont, deleteCustomFont } from "./actions";
import { FontUploadField } from "@/components/admin/FontUploadField";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { SaveButton } from "@/components/admin/SaveButton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomFontOption } from "@/lib/fonts";

const selectClass =
  "flex h-10 w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Lists uploaded custom fonts and lets the owner add or remove them. Adding
 * one is two steps under the hood — upload the file first (FontUploadField,
 * straight to /api/admin/upload-font), then save a labeled row pointing at
 * it (addCustomFont) — but reads as one form: the file, format and fallback
 * are held in local state and only committed as hidden fields once a name
 * is given and "Add font" is pressed. */
export function CustomFontsManager({ fonts }: { fonts: CustomFontOption[] }) {
  const [pending, setPending] = useState<{ url: string; format: string } | null>(null);
  const [label, setLabel] = useState("");
  const [fallback, setFallback] = useState("sans-serif");

  return (
    <div>
      <Label className="label-caps mb-2 block">Uploaded fonts</Label>
      <Card className="mb-4 border-line shadow-none">
        <CardContent className="p-0">
          {fonts.map((font) => (
            <div key={font.id} className="flex items-center gap-3 border-b border-line px-3 py-3 last:border-0">
              <span className="flex-1 text-sm" style={{ fontFamily: `"Custom Font ${font.id}", ${font.fallback}` }}>
                {font.label}
              </span>
              <span className="shrink-0 text-xs uppercase text-stone">{font.format}</span>
              <form action={deleteCustomFont.bind(null, font.id)}>
                <ConfirmSubmitButton
                  confirmText={`Remove "${font.label}"? If it's currently in use for headings or body text, those will fall back to the site default.`}
                  className="whitespace-nowrap text-xs text-stone underline hover:text-accent"
                >
                  Remove
                </ConfirmSubmitButton>
              </form>
            </div>
          ))}
          {fonts.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-stone">No custom fonts uploaded yet.</p>
          )}
        </CardContent>
      </Card>

      <details className="group" open={!!pending}>
        <summary className="label-caps w-fit cursor-pointer">+ Upload a font</summary>
        <Card className="mt-4 border-line shadow-none">
          <CardContent className="max-w-md space-y-4 p-4">
            <p className="text-xs text-stone">
              Only upload fonts you're licensed to use on a website — .woff2, .woff, .ttf, or .otf, up to 8MB.
            </p>

            {!pending && <FontUploadField onUploaded={setPending} />}

            {pending && (
              <form
                action={async (formData) => {
                  await addCustomFont(formData);
                  setPending(null);
                  setLabel("");
                  setFallback("sans-serif");
                }}
                className="space-y-4"
              >
                <input type="hidden" name="fileUrl" value={pending.url} />
                <input type="hidden" name="format" value={pending.format} />
                <p className="text-xs text-stone">
                  File uploaded ({pending.format}). Give it a name and pick a fallback, then add it.
                </p>
                <div>
                  <Label htmlFor="customFontLabel" className="label-caps mb-2 block">
                    Name
                  </Label>
                  <Input
                    id="customFontLabel"
                    name="label"
                    required
                    placeholder="e.g. Brand Display"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="border-line"
                  />
                </div>
                <div>
                  <Label htmlFor="customFontFallback" className="label-caps mb-2 block">
                    Fallback while it loads
                  </Label>
                  <select
                    id="customFontFallback"
                    name="fallback"
                    value={fallback}
                    onChange={(e) => setFallback(e.target.value)}
                    className={selectClass}
                  >
                    <option value="serif">Serif</option>
                    <option value="sans-serif">Sans-serif</option>
                    <option value="monospace">Monospace</option>
                    <option value="system-ui">System default</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <SaveButton>Add font</SaveButton>
                  <button
                    type="button"
                    onClick={() => setPending(null)}
                    className="text-xs text-stone underline hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </details>
    </div>
  );
}
