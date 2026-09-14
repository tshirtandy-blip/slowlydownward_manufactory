import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { HeaderSettingsForm } from "./HeaderSettingsForm";

export const dynamic = "force-dynamic";

export default async function HeaderSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div>
      <Link href="/admin/settings" className="label-caps text-stone hover:text-ink">
        ← Settings
      </Link>
      <h1 className="font-display text-2xl mt-2 mb-2">Header &amp; branding</h1>
      <p className="text-sm text-stone mb-8 max-w-lg">
        Controls the header shown on every storefront page — the logo, where it sits, and which icons appear
        alongside it.
      </p>

      <div className="mb-8">
        <p className="label-caps mb-2">Preview — this is your site's actual header</p>
        <div className="border hairline overflow-hidden">
          <SiteHeader />
        </div>
      </div>

      {/* Keyed on updatedAt so the form's internal state resets to the
          latest saved values after every save (including the separate
          "Remove logo" action), rather than holding onto stale state. */}
      <HeaderSettingsForm key={settings.updatedAt.getTime()} initial={settings} />
    </div>
  );
}
