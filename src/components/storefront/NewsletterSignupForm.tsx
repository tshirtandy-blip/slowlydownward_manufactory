"use client";

import { useState, useTransition } from "react";
import { subscribeToNewsletter } from "@/lib/newsletter";

/** The "leave your email" form shared by the site footer and the
 * cookie/signup popup (CookieConsentPopup.tsx) — one place for the actual
 * submit behaviour so both stay in sync. Purely opt-in: nothing here is
 * pre-ticked, and submitting this has no effect on the separate cookie
 * notice. */
export function NewsletterSignupForm({
  buttonLabel = "Join",
  inputClassName = "flex-1 border hairline bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-ink",
  buttonClassName = "btn-secondary !px-4 !py-2",
  layoutClassName = "flex gap-2",
}: {
  buttonLabel?: string;
  inputClassName?: string;
  buttonClassName?: string;
  layoutClassName?: string;
}) {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("idle");
    startTransition(async () => {
      const result = await subscribeToNewsletter(email);
      if (result.ok) {
        setStatus("done");
        setEmail("");
      } else {
        setStatus("error");
        setError(result.error);
      }
    });
  }

  if (status === "done") {
    return <p className="text-sm">Thanks — you're on the list.</p>;
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className={layoutClassName}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className={inputClassName}
        />
        <button type="submit" disabled={pending} className={buttonClassName + " disabled:opacity-50"}>
          {pending ? "…" : buttonLabel}
        </button>
      </form>
      {status === "error" && <p className="text-xs text-accent mt-2">{error}</p>}
    </div>
  );
}
