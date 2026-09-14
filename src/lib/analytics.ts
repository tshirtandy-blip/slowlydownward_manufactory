import { prisma } from "@/lib/prisma";

// How recent a Visitor row's lastSeenAt has to be to count as "here right
// now" — a little more than the tracker's ~45s heartbeat, so one missed
// beacon doesn't make someone vanish from the count.
const LIVE_WINDOW_MS = 2 * 60 * 1000;
const CHECKING_OUT_WINDOW_MS = 20 * 60 * 1000;
const PURCHASED_WINDOW_MS = 10 * 60 * 1000;

export async function getLiveActivity() {
  const now = Date.now();
  const liveSince = new Date(now - LIVE_WINDOW_MS);
  const daySince = new Date(now - 24 * 60 * 60 * 1000);
  const weekSince = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const checkingOutSince = new Date(now - CHECKING_OUT_WINDOW_MS);
  const purchasedSince = new Date(now - PURCHASED_WINDOW_MS);

  const [visitorsNow, visitors24h, visitorsWeek, basketsActive, checkingOut, purchasedLast10Min] =
    await Promise.all([
      prisma.visitor.count({ where: { lastSeenAt: { gte: liveSince } } }),
      prisma.visitor.count({ where: { lastSeenAt: { gte: daySince } } }),
      prisma.visitor.count({ where: { lastSeenAt: { gte: weekSince } } }),
      // "Has items in their basket" only counts as long as they're still
      // recently active — a cart abandoned days ago shouldn't show as
      // someone currently shopping.
      prisma.visitor.count({ where: { cartItemCount: { gt: 0 }, lastSeenAt: { gte: liveSince } } }),
      // An order row is created the moment someone clicks "Checkout with
      // Stripe", before they've paid — still PENDING_PAYMENT and recent
      // means they're somewhere in the payment flow right now (or just
      // abandoned it a few minutes ago, which this can't tell apart from
      // still being on the Stripe page).
      prisma.order.count({ where: { status: "PENDING_PAYMENT", createdAt: { gte: checkingOutSince } } }),
      prisma.order.count({
        where: { status: { in: ["PAID", "PACKING", "PACKED", "SHIPPED"] as any }, updatedAt: { gte: purchasedSince } },
      }),
    ]);

  return { visitorsNow, visitors24h, visitorsWeek, basketsActive, checkingOut, purchasedLast10Min };
}
