"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps an already-open admin page fresh on its own. Next.js only re-fetches
 * a server-rendered page's data when you navigate to it — a page that's
 * just sitting open (Orders, waiting to see a sale land; an order's own
 * page, waiting for it to flip from "pending payment" to "paid") never
 * updates by itself, which is why a manual browser reload was needed to see
 * something that had already happened. This runs router.refresh() every
 * `intervalMs` instead, so the page quietly re-renders with whatever's
 * actually in the database now. Renders nothing.
 */
export function AutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
