"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCart } from "@/lib/cart-context";
import { getOrCreateVisitorId } from "@/lib/visitor-id";

const HEARTBEAT_MS = 45_000;
// Every Role other than "CUSTOMER" (see src/types/next-auth.d.ts /
// src/lib/auth.ts) is staff.
const STAFF_ROLES = ["ADMIN", "SALES", "STOCK", "PACKER"];

/** Mounted once, inside CartProvider, in the root layout. Sends a tiny
 * anonymous "still here, this many items in my basket" beacon on load and
 * every 45s after — see /api/track/visit and src/lib/analytics.ts. Renders
 * nothing; failures are silent and never affect the page. */
export function VisitorTracker() {
  const { count, hydrated } = useCart();
  const pathname = usePathname();
  const { data: session } = useSession();

  // Staff working in the admin area aren't "site visitors" — counting them
  // would inflate the dashboard's own numbers with the person looking at
  // it. Same goes for a staff member who's signed in but happens to be
  // browsing the storefront itself (e.g. checking how something looks) —
  // that's still not a real visitor, even though the path isn't /admin.
  const isAdminPath = pathname?.startsWith("/admin");
  const isStaffSession = !!session?.user?.role && STAFF_ROLES.includes(session.user.role as string);
  const skip = isAdminPath || isStaffSession;

  useEffect(() => {
    if (skip) return;
    // Wait for the cart to finish reading localStorage so the very first
    // beacon reports the real basket size, not a momentary "empty".
    if (!hydrated) return;

    function send() {
      const visitorId = getOrCreateVisitorId();
      fetch("/api/track/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, cartItemCount: count }),
        keepalive: true,
      }).catch(() => {
        // Best-effort only — a failed beacon just means this visit isn't
        // counted for a little while.
      });
    }

    send();
    const interval = setInterval(send, HEARTBEAT_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, count, skip]);

  return null;
}
