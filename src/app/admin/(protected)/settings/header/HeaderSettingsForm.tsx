"use client";

import { useState } from "react";
import { updateHeaderSettings, removeLogo } from "./actions";
import { ImageDropzone } from "@/components/admin/ImageDropzone";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { SaveButton } from "@/components/admin/SaveButton";
import type { HeaderSettings } from "@/lib/header-settings-context";

const inputClass = "border hairline bg-transparent px-3 py-2 text-sm w-full";

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
    <div className="space-y-8 max-w-lg">
      <form action={updateHeaderSettings} className="space-y-8">
        <div>
          <label className="label-caps block mb-3">Logo</label>
          <div className="flex gap-6 mb-4 text-sm">
            {(["TEXT", "IMAGE", "NONE"] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-2">
                <input type="radio" name="logoType" value={opt} checked={logoType === opt} onChange={() => setLogoType(opt)} />
                {opt === "TEXT" ? "Text" : opt === "IMAGE" ? "Image" : "None"}
              </label>
            ))}
          </div>

          <input
            name="logoText"
            value={logoText}
            onChange={(e) => setLogoText(e.target.value)}
            hidden={logoType !== "TEXT"}
            placeholder="Slowly Downward"
            className={inputClass}
          />

          {logoType === "IMAGE" && (
            <>
              <ImageDropzone value={logoImageUrl} onChange={setLogoImageUrl} />
              <input type="hidden" name="logoImageUrl" value={logoImageUrl} />
            </>
          )}

          {logoType === "NONE" && <p className="text-sm text-stone">No logo will be shown in the header.</p>}
        </div>

        {logoType !== "NONE" && (
          <div>
            <label className="label-caps block mb-2">Logo size</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setLogoScale((s) => Math.max(25, s - 10))}
                aria-label="Make logo smaller"
                className="w-8 h-8 border hairline flex items-center justify-center hover:border-ink"
              >
                −
              </button>
              <span className="text-sm w-12 text-center tabular-nums">{logoScale}%</span>
              <button
                type="button"
                onClick={() => setLogoScale((s) => Math.min(300, s + 10))}
                aria-label="Make logo bigger"
                className="w-8 h-8 border hairline flex items-center justify-center hover:border-ink"
              >
                +
              </button>
            </div>
            <input type="hidden" name="logoScale" value={logoScale} />
          </div>
        )}

        <div>
          <label className="label-caps block mb-2">Logo position</label>
          <select name="logoPosition" defaultValue={initial.logoPosition} className={inputClass + " max-w-[200px]"}>
            <option value="LEFT">Left</option>
            <option value="CENTER">Centre</option>
            <option value="RIGHT">Right</option>
          </select>
        </div>

        <div className="border-t hairline pt-6">
          <label className="flex items-center gap-2 text-sm mb-3">
            <input type="checkbox" name="showCartIcon" checked={showCartIcon} onChange={(e) => setShowCartIcon(e.target.checked)} />
            Show cart icon
          </label>
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
        </div>

        <div className="border-t hairline pt-6">
          <label className="flex items-center gap-2 text-sm mb-3">
            <input
              type="checkbox"
              name="showAccountIcon"
              checked={showAccountIcon}
              onChange={(e) => setShowAccountIcon(e.target.checked)}
            />
            Show account icon
          </label>
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
          <p className="text-xs text-stone mt-2">
            Links to /account. Customer sign-in itself isn't built yet — that page just says "coming soon" for now.
          </p>
        </div>

        <div className="border-t hairline pt-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="showCurrencySelector" defaultChecked={initial.showCurrencySelector} />
            Show currency selector
          </label>
          <p className="text-xs text-stone mt-2">
            Converts displayed prices only, for browsing — customers are always charged in the store's own
            currency at checkout.
          </p>
        </div>

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
