"use client";

import { useState } from "react";
import { updateTypography } from "./actions";
import { FONT_OPTIONS, fontStackFor, customFontKey, type CustomFontOption } from "@/lib/fonts";
import { SaveButton } from "@/components/admin/SaveButton";

const inputClass = "border hairline bg-transparent px-3 py-2 text-sm w-full";

export function TypographySettingsForm({
  initialHeadingFont,
  initialBodyFont,
  customFonts,
}: {
  initialHeadingFont: string;
  initialBodyFont: string;
  customFonts: CustomFontOption[];
}) {
  const [headingFont, setHeadingFont] = useState(initialHeadingFont);
  const [bodyFont, setBodyFont] = useState(initialBodyFont);

  return (
    <form action={updateTypography} className="space-y-8">
      <div>
        <label className="label-caps block mb-2">Headings &amp; print titles</label>
        <select
          name="headingFont"
          value={headingFont}
          onChange={(e) => setHeadingFont(e.target.value)}
          className={inputClass}
        >
          <optgroup label="Built-in">
            {FONT_OPTIONS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </optgroup>
          {customFonts.length > 0 && (
            <optgroup label="Uploaded">
              {customFonts.map((f) => (
                <option key={f.id} value={customFontKey(f.id)}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <p className="mt-2 text-lg" style={{ fontFamily: fontStackFor(headingFont, customFonts) }}>
          The quick brown fox
        </p>
      </div>

      <div>
        <label className="label-caps block mb-2">Body text</label>
        <select
          name="bodyFont"
          value={bodyFont}
          onChange={(e) => setBodyFont(e.target.value)}
          className={inputClass}
        >
          <optgroup label="Built-in">
            {FONT_OPTIONS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </optgroup>
          {customFonts.length > 0 && (
            <optgroup label="Uploaded">
              {customFonts.map((f) => (
                <option key={f.id} value={customFontKey(f.id)}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <p className="mt-2 text-sm" style={{ fontFamily: fontStackFor(bodyFont, customFonts) }}>
          The quick brown fox jumps over the lazy dog.
        </p>
      </div>

      <SaveButton>Save typography</SaveButton>
    </form>
  );
}
