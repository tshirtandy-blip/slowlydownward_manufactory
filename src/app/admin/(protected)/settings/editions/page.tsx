import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";
import { EditionSettingsForm } from "./EditionSettingsForm";

export const dynamic = "force-dynamic";

export default async function EditionSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div className="max-w-3xl">
      <Link href="/admin/settings" className="label-caps text-stone hover:text-ink">
        ← Settings
      </Link>
      <h1 className="font-display text-2xl mt-2 mb-2">Editions</h1>
      <p className="text-sm text-stone mb-8 max-w-xl">
        Controls for when a customer picks a specific edition number on a print's page — how long it's held
        just for them, and the note shown next to the picker.
      </p>
      <EditionSettingsForm minutes={settings.editionReservationMinutes} note={settings.editionPickerNote} />
    </div>
  );
}
