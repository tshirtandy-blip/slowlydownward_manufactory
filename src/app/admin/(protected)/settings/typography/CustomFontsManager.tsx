"use client";

import { useState } from "react";
import { addCustomFont, deleteCustomFont } from "./actions";
import { FontUploadField } from "@/components/admin/FontUploadField";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { SaveButton } from "@/components/admin/SaveButton";
import type { CustomFontOption } from "@/lib/fonts";

const inputClass = "border hairline bg-transparent px-3 py-2 text-sm w-full";

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
      <label className="label-caps block mb-2">Uploaded fonts</label>
      <div className="border hairline mb-4">
        {fonts.map((font) => (
          <div key={font.id} className="flex items-center gap-3 px-3 py-3 border-b hairline last:border-0">
            <span className="flex-1 text-sm" style={{ fontFamily: `"Custom Font ${font.id}", ${font.fallback}` }}>
              {font.label}
            </span>
            <span className="text-xs text-stone uppercase shrink-0">{font.format}</span>
            <form action={deleteCustomFont.bind(null, font.id)}>
              <ConfirmSubmitButton
                confirmText={`Remove "${font.label}"? If it's currently in use for headings or body text, those will fall back to the site default.`}
                className="text-xs text-stone hover:text-accent underline whitespace-nowrap"
              >
                Remove
              </ConfirmSubmitButton>
            </form>
          </div>
        ))}
        {fonts.length === 0 && (
          <p className="px-3 py-6 text-sm text-stone text-center">No custom fonts uploaded yet.</p>
        )}
      </div>

      <details className="border hairline p-4" open={!!pending}>
        <summary className="label-caps cursor-pointer">+ Upload a font</summary>
        <div className="mt-4 max-w-md space-y-4">
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
                <label className="label-caps block mb-2">Name</label>
                <input
                  name="label"
                  required
                  placeholder="e.g. Brand Display"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="label-caps block mb-2">Fallback while it loads</label>
                <select
                  name="fallback"
                  value={fallback}
                  onChange={(e) => setFallback(e.target.value)}
                  className={inputClass}
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
                  className="text-xs text-stone hover:text-ink underline"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </details>
    </div>
  );
}
