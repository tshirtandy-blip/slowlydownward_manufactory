"use client";

import { useState, useTransition } from "react";
import { ImageDropzone } from "@/components/admin/ImageDropzone";
import { updateEmailLogo } from "./actions";
import { Card, CardContent } from "@/components/ui/card";

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
    <Card className="mb-8 max-w-2xl border-line shadow-none">
      <CardContent className="p-6">
        <h2 className="label-caps mb-2">Email header logo</h2>
        <p className="mb-4 text-sm text-stone">
          Shown centered at the top of every email below, above your own wording. Leave it empty to send emails
          with no header image, just the message itself.
        </p>
        <ImageDropzone value={logoUrl} onChange={save} />
        {pending && <p className="mt-2 text-xs text-stone">Saving…</p>}
        {saved && !pending && <p className="mt-2 text-xs text-stone">Saved.</p>}
        {logoUrl && (
          <button
            type="button"
            onClick={() => save("")}
            className="mt-3 text-xs text-stone underline hover:text-ink"
          >
            Remove logo
          </button>
        )}
      </CardContent>
    </Card>
  );
}
