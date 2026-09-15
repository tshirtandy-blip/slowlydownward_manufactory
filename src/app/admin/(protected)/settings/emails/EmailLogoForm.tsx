"use client";

import { useState, useTransition } from "react";
import { ImageDropzone } from "@/components/admin/ImageDropzone";
import { updateEmailLogo } from "./actions";

/** The logo shown at the top of every transactional email — applies to all
 * of them at once (payment link, order confirmation, welcome), same as the
 * items table or CTA button below it, so it lives here rather than on each
 * template's own edit page. */
export function EmailLogoForm({ initialLogoUrl }: { initialLogoUrl: string }) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(nextUrl: string) {
    setLogoUrl(nextUrl);
    setSaved(false);
    startTransition(async () => {
      await updateEmailLogo(nextUrl);
      setSaved(true);
    });
  }

  return (
    <div className="border hairline p-6 mb-8 max-w-2xl">
      <h2 className="label-caps mb-2">Email header logo</h2>
      <p className="text-sm text-stone mb-4">
        Shown centered at the top of every email below, above your own wording. Leave it empty to send emails
        with no header image, just the message itself.
      </p>
      <ImageDropzone value={logoUrl} onChange={save} />
      {pending && <p className="text-xs text-stone mt-2">Saving…</p>}
      {saved && !pending && <p className="text-xs text-stone mt-2">Saved.</p>}
      {logoUrl && (
        <button
          type="button"
          onClick={() => save("")}
          className="text-xs underline text-stone hover:text-ink mt-3"
        >
          Remove logo
        </button>
      )}
    </div>
  );
}
