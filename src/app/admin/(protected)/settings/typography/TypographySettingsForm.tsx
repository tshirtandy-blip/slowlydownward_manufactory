"use client";

import { useState } from "react";
import { updateTypography } from "./actions";
import { FONT_OPTIONS, fontStackFor, customFontKey, type CustomFontOption } from "@/lib/fonts";
import { SaveButton } from "@/components/admin/SaveButton";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const selectClass =
  "flex h-10 w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

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
    <form action={updateTypography} className="space-y-6">
      <Card className="border-line shadow-none">
        <CardContent className="p-6">
          <Label htmlFor="headingFont" className="label-caps mb-2 block">
            Headings &amp; print titles
          </Label>
          <select
            id="headingFont"
            name="headingFont"
            value={headingFont}
            onChange={(e) => setHeadingFont(e.target.value)}
            className={selectClass}
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
        </CardContent>
      </Card>

      <Card className="border-line shadow-none">
        <CardContent className="p-6">
          <Label htmlFor="bodyFont" className="label-caps mb-2 block">
            Body text
          </Label>
          <select
            id="bodyFont"
            name="bodyFont"
            value={bodyFont}
            onChange={(e) => setBodyFont(e.target.value)}
            className={selectClass}
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
        </CardContent>
      </Card>

      <SaveButton>Save typography</SaveButton>
    </form>
  );
}
