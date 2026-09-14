import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { releaseExpiredReservations } from "@/lib/edition-reservations";

/**
 * Allocates a physical edition to an order item for a given print.
 *
 * Default behaviour: pick the lowest-numbered AVAILABLE edition for the
 * print — not a random one — so that "no preference" orders work through
 * the drawer in order rather than leaving whoever's packing to go hunting
 * for a scattered, random number every time. If `requestedNumber` is given
 * and that edition is still available to them, it's used instead
 * (first-come-first-served — this is called inside a transaction with a row
 * lock so two simultaneous buyers can't get the same copy).
 *
 * A number a customer reserved while shopping (see
 * src/lib/edition-reservations.ts) sits in status RESERVED, not AVAILABLE,
 * for as long as their hold lasts — which is normally still true right now,
 * since paying usually takes well under the hold's few minutes. So a
 * requested number is claimable here if it's AVAILABLE (never reserved, or
 * its hold has simply lapsed — releaseExpiredReservations below puts it
 * back to AVAILABLE the moment that happens) OR still RESERVED under the
 * exact reservation this order was given at checkout (`reservationToken`,
 * copied onto the OrderItem there) — never a RESERVED row held by someone
 * else's still-active hold, which falls through to random allocation
 * instead, same as any other unavailable requested number.
 *
 * Throws if no edition is available (caller should treat the print as sold
 * out and refund / cancel).
 *
 * Returns `{ edition, mismatch }` — `mismatch` is null when the requested
 * number (if any) was honoured, and otherwise a plain-English reason the
 * caller can record (the webhook route writes it to the audit log) so a
 * "customer got the wrong number" report can be looked into with hard
 * evidence instead of guesswork.
 */
export async function allocateEdition(
  tx: Prisma.TransactionClient,
  printId: string,
  requestedNumber?: number | null,
  reservationToken?: string | null
) {
  await releaseExpiredReservations(tx, printId);

  let mismatch: { reason: string; editionStatus: string | null; heldByToken: string | null } | null = null;

  if (requestedNumber) {
    const requested = await tx.edition.findUnique({
      where: { printId_number: { printId, number: requestedNumber } },
    });
    const claimable =
      !!requested &&
      (requested.status === "AVAILABLE" ||
        (requested.status === "RESERVED" && !!reservationToken && requested.reservationToken === reservationToken));
    if (claimable) {
      const edition = await tx.edition.update({
        where: { id: requested!.id },
        data: { status: "SOLD", soldAt: new Date(), reservedAt: null, reservedUntil: null, reservationToken: null },
      });
      return { edition, mismatch: null };
    }
    // Requested number not available — fall through to the next one up.
    mismatch = {
      reason: !requested
        ? "That edition number didn't exist on this print."
        : requested.status === "SOLD"
        ? "It had already been sold to someone else by the time payment went through."
        : requested.status === "RESERVED"
        ? "It was being held by a different reservation (not this order's) when payment went through."
        : `It was marked "${requested.status}" (not available) when payment went through.`,
      editionStatus: requested?.status ?? null,
      heldByToken: requested?.reservationToken ?? null,
    };
  }

  const nextUp = await tx.edition.findFirst({
    where: { printId, status: "AVAILABLE" },
    select: { id: true },
    orderBy: { number: "asc" },
  });
  if (!nextUp) {
    throw new Error(`No available editions left for print ${printId}`);
  }

  const edition = await tx.edition.update({
    where: { id: nextUp.id },
    data: { status: "SOLD", soldAt: new Date(), reservedAt: null, reservedUntil: null, reservationToken: null },
  });
  return { edition, mismatch };
}

export function editionSummary(available: number, total: number | null) {
  // Open editions aren't limited or numbered — no count is ever shown for
  // them, on the storefront or in the admin.
  if (total === null) return "Open edition";
  if (available === 0) return "Sold out";
  if (available === total) return `Edition of ${total}`;
  return `${available} of ${total} remaining`;
}
