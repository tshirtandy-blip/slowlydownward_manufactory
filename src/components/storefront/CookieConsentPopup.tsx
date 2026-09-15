"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NewsletterSignupForm } from "@/components/storefront/NewsletterSignupForm";

const STORAGE_KEY = "slowlydownward_cookie_consent";

export type CookiePopupSettings = {
  cookiePopupEnabled: boolean;
  cookiePopupMessage: string;
  cookiePopupSignupHeading: string;
  cookiePopupSignupBody: string;
};

/** First-visit notice at the bottom of the screen — the cookie disclosure
 * on the left, a completely separate "hear about new releases" signup on
 * the right (same NewsletterSignupForm the footer uses). Two independent
 * consents shown together, not one bundled into the other: accepting the
 * cookie notice never opts anyone into marketing email, and leaving an
 * email address never depends on having accepted the notice.
 *
 * "Accepted" is remembered in localStorage (same convention as the rest
 * of this app's client-side state — see src/lib/visitor-id.ts,
 * src/lib/cart-context.tsx) rather than a real cookie, since there's
 * nothing else on the site right now that actually needs a cookie to be
 * set before the visitor decides. Shown on the storefront only — not in
 * Admin, same exclusion VisitorTracker uses. */
export function CookieConsentPopup({ settings }: { settings: CookiePopupSettings }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isAdmin || !settings.cookiePopupEnabled) return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Storage unavailable (private browsing, etc.) — just don't show
      // the popup rather than showing it on every single page load.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, settings.cookiePopupEnabled]);

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // Nothing we can do if storage is unavailable — just close it for
      // this page view.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-paper border-t hairline">
      <div className="mx-auto max-w-6xl px-6 py-6 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
        <p className="text-sm text-stone">{settings.cookiePopupMessage}</p>

        <div className="hidden md:block w-px self-stretch bg-line" />

        <div>
          <p className="label-caps mb-1">{settings.cookiePopupSignupHeading}</p>
          <p className="text-xs text-stone mb-3">{settings.cookiePopupSignupBody}</p>
          <NewsletterSignupForm buttonLabel="Join" />
        </div>
      </div>
      <div className="border-t hairline">
        <div className="mx-auto max-w-6xl px-6 py-3 flex justify-end">
          <button type="button" onClick={accept} className="btn-primary !px-6 !py-2">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
