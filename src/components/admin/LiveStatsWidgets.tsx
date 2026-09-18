"use client";

import { useEffect, useState } from "react";
import { StatTile } from "@/components/admin/StatTile";

type LiveStats = {
  visitorsNow: number;
  visitors24h: number;
  visitorsWeek: number;
  basketsActive: number;
  checkingOut: number;
  purchasedLast10Min: number;
};

const POLL_MS = 10_000;

/** The dashboard's "right now" row — server-rendered once for an instant
 * first paint (via `initial`), then kept fresh by polling /api/admin/live-stats
 * every 10s. No websockets needed at this scale; a short poll is plenty for
 * numbers that are inherently rough (see src/lib/analytics.ts). */
export function LiveStatsWidgets({ initial }: { initial: LiveStats }) {
  const [stats, setStats] = useState<LiveStats>(initial);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/admin/live-stats", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        // A missed poll just means the numbers stay as they were a moment
        // ago — never worth showing an error for.
      }
    }
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <StatTile
          label="Visitors right now"
          value={String(stats.visitorsNow)}
          hint="Active in the last 2 minutes"
          live
        />
        <StatTile label="Visitors — last 24h" value={String(stats.visitors24h)} />
        <StatTile label="Visitors — this week" value={String(stats.visitorsWeek)} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatTile
          label="Baskets with items"
          value={String(stats.basketsActive)}
          hint="Active in the last 2 minutes"
        />
        <StatTile
          label="Checking out"
          value={String(stats.checkingOut)}
          hint="Started in the last 20 minutes, not yet paid"
        />
        <StatTile
          label="Purchased — last 10 min"
          value={String(stats.purchasedLast10Min)}
        />
      </div>
    </div>
  );
}
