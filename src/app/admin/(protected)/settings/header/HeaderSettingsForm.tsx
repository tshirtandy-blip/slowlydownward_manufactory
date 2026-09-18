"use client";

import { useState } from "react";
import { updateHeaderSettings, removeLogo } from "./actions";
import { ImageDropzone } from "@/components/admin/ImageDropzone";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { SaveButton } from "@/components/admin/SaveButton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { HeaderSettings } from "@/lib/header-settings-context";

export function HeaderSettingsForm({ initial }: { initial: HeaderSettings }) {
  const [logoType, setLogoType] = useState(initial.logoType);
  const [logoText, setLogoText] = useState(initial.logoText ?? "");
  const [logoImageUrl, setLogoImageUrl] = useState(initial.logoImageUrl ?? "");
  const [logoScale, setLogoScale] = useState(initial.logoScale ?? 100);
  const [showCartIcon, setShowCartIcon] = useState(initial.showCartIcon);
  const [cartIconUrl, setCartIconUrl] = useState(initial.cartIconUrl ?? "");
  const [showAccountIcon, setShowAccountIcon] = useState(initial.showAccountIcon);
  const [accountIconUrl, setAccountIconUrl] = useState(initial.accountIconUrl ?? "");

  return (
    <div className="max-w-xl space-y-6">
      <form action={updateHeaderSettings} className="space-y-6">
        <Card className="border-line shadow-none">
          <CardContent className="space-y-4 p-6">
            <Label className="label-caps block">Logo</Label>
            <div className="flex gap-6 text-sm">
              {(["TEXT", "IMAGE", "NONE"] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="logoType"
                    value={opt}
                    checked={logoType === opt}
                    onChange={() => setLogoType(opt)}
                    className="accent-ink"
                  />
                  {opt === "TEXT" ? "Text" : opt === "IMAGE" ? "Image" : "None"}
                </label>
              ))}
            </div>

            <Input
              name="logoText"
              value={logoText}
              onChange={(e) => setLogoText(e.target.value)}
              hidden={logoType !== "TEXT"}
              placeholder="Slowly Downward"
              className="border-line"
            />

            {logoType === "IMAGE" && (
              <>
                <ImageDropzone value={logoImageUrl} onChange={setLogoImageUrl} />
                <input type="hidden" name="logoImageUrl" value={logoImageUrl} />
              </>
            )}

            {logoType === "NONE" && <p className="text-sm text-stone">No logo will be shown in the header.</p>}
          </CardContent>
        </Card>

        {logoType !== "NONE" && (
          <Card className="border-line shadow-none">
            <CardContent className="p-6">
              <Label className="label-caps mb-2 block">Logo size</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setLogoScale((s) => Math.max(25, s - 10))}
                  aria-label="Make logo smaller"
                  className="h-8 w-8 border-line"
                >
                  −
                </Button>
                <span className="w-12 text-center text-sm tabular-nums">{logoScale}%</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setLogoScale((s) => Math.min(300, s + 10))}
                  aria-label="Make logo bigger"
                  className="h-8 w-8 border-line"
                >
                  +
                </Button>
              </div>
              <input type="hidden" name="logoScale" value={logoScale} />
            </CardContent>
          </Card>
        )}

        <Card className="border-line shadow-none">
          <CardContent className="p-6">
            <Label htmlFor="logoPosition" className="label-caps mb-2 block">
              Logo position
            </Label>
            <select
              id="logoPosition"
              name="logoPosition"
              defaultValue={initial.logoPosition}
              className="flex h-10 w-full max-w-[200px] border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="LEFT">Left</option>
              <option value="CENTER">Centre</option>
              <option value="RIGHT">Right</option>
            </select>
          </CardContent>
        </Card>

        <Card className="border-line shadow-none">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="showCartIcon"
                name="showCartIcon"
                checked={showCartIcon}
                onCheckedChange={(v) => setShowCartIcon(v === true)}
              />
              <Label htmlFor="showCartIcon" className="text-sm font-normal">
                Show cart icon
              </Label>
            </div>
            {showCartIcon && (
              <>
                <ImageDropzone
                  value={cartIconUrl}
                  onChange={setCartIconUrl}
                  label="Custom cart icon (optional — leave blank to use the default)"
                />
                <input type="hidden" name="cartIconUrl" value={cartIconUrl} />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-line shadow-none">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="showAccountIcon"
                name="showAccountIcon"
                checked={showAccountIcon}
                onCheckedChange={(v) => setShowAccountIcon(v === true)}
              />
              <Label htmlFor="showAccountIcon" className="text-sm font-normal">
                Show account icon
              </Label>
            </div>
            {showAccountIcon && (
              <>
                <ImageDropzone
                  value={accountIconUrl}
                  onChange={setAccountIconUrl}
                  label="Custom account icon (optional — leave blank to use the default)"
                />
                <input type="hidden" name="accountIconUrl" value={accountIconUrl} />
              </>
            )}
            <p className="text-xs text-stone">
              Links to /account. Customer sign-in itself isn't built yet — that page just says "coming soon" for now.
            </p>
          </CardContent>
        </Card>

        <Card className="border-line shadow-none">
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Checkbox id="showCurrencySelector" name="showCurrencySelector" defaultChecked={initial.showCurrencySelector} />
              <Label htmlFor="showCurrencySelector" className="text-sm font-normal">
                Show currency selector
              </Label>
            </div>
            <p className="mt-2 text-xs text-stone">
              Converts displayed prices only, for browsing — customers are always charged in the store's own
              currency at checkout.
            </p>
          </CardContent>
        </Card>

        <SaveButton>Save header settings</SaveButton>
      </form>

      {logoType !== "NONE" && (
        <form action={removeLogo} className="pt-2">
          <ConfirmSubmitButton
            confirmText="Remove the current logo? The header will show no logo until you add one back."
            className="text-xs text-stone hover:text-accent"
          >
            Remove logo
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
