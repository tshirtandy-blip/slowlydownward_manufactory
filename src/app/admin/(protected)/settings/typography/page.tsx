import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";
import { getCustomFonts } from "@/lib/custom-fonts";
import { TypographySettingsForm } from "./TypographySettingsForm";
import { CustomFontsManager } from "./CustomFontsManager";

export const dynamic = "force-dynamic";

export default async function TypographySettingsPage() {
  const [settings, customFonts] = await Promise.all([getSiteSettings(), getCustomFonts()]);

  return (
    <div className="max-w-lg">
      <Link href="/admin/settings" className="label-caps text-stone hover:text-ink">
        ← Settings
      </Link>
      <h1 className="font-display text-2xl mt-2 mb-2">Typography</h1>
      <p className="text-sm text-stone mb-8">
        Choose the typefaces used across the website — one for headings and print titles, one for body text.
        Changes apply everywhere immediately.
      </p>

      <TypographySettingsForm
        key={settings.updatedAt.getTime()}
        initialHeadingFont={settings.headingFont}
        initialBodyFont={settings.bodyFont}
        customFonts={customFonts}
      />

      <hr className="border-t border-line my-10" />

      <CustomFontsManager fonts={customFonts} />
    </div>
  );
}
