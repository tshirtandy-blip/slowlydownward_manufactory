import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Client = PrismaClient | Prisma.TransactionClient;

/**
 * Puts back up for grabs any edition of this print whose reservation window
 * has passed. There's no background job in this app to watch the clock, so
 * this runs inline, right before anything that needs an accurate picture of
 * what's actually available: viewing a print's page, trying to reserve a
 * number, checking out, allocating a copy at payment time, and the admin
 * stock page.
 */
export async function releaseExpiredReservations(client: Client, printId: string) {
  await client.edition.updateMany({
    where: { printId, status: "RESERVED", reservedUntil: { lt: new Date() } },
    data: { status: "AVAILABLE", reservedAt: null, reservedUntil: null, reservationToken: null },
  });
}

export type ReserveResult = { ok: true; expiresAt: Date } | { ok: false; error: string };

/**
 * Holds one specific edition number for the browser identified by `token`,
 * for `minutes` from now — first-come-first-served, and safe under
 * concurrent attempts for the same number (the actual claim is one
 * conditional UPDATE ... WHERE status = 'AVAILABLE', so only one of two
 * simultaneous requests can ever succeed). Re-reserving the same number you
 * already hold just extends it rather than failing. A customer can hold more
 * than one number of the same print at once (see AddToCartForm.tsx's "Add
 * another copy") — this used to release any other number of the same print
 * a browser held, back when only one reservation per print was possible;
 * that would now silently drop an earlier pick's hold the moment a second
 * one was made, wide open to someone else grabbing it in between.
 */
export async function reserveEdition(
  printId: string,
  number: number,
  token: string,
  minutes: number
): Promise<ReserveResult> {
  await releaseExpiredReservations(prisma, printId);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + minutes * 60_000);

  const existing = await prisma.edition.findUnique({ where: { printId_number: { printId, number } } });
  if (!existing) return { ok: false, error: "That edition number doesn't exist." };

  if (existing.status === "RESERVED" && existing.reservationToken === token) {
    // Already yours (re-selecting the same number, or a page refresh) —
    // just extend the hold rather than run the AVAILABLE-only claim below,
    // which an already-RESERVED row could never pass.
    await prisma.edition.update({
      where: { id: existing.id },
      data: { reservedAt: now, reservedUntil: expiresAt },
    });
  } else {
    const claim = await prisma.edition.updateMany({
      where: { id: existing.id, status: "AVAILABLE" },
      data: { status: "RESERVED", reservedAt: now, reservedUntil: expiresAt, reservationToken: token },
    });
    if (claim.count === 0) {
      return { ok: false, error: "Sorry — that edition number was just taken. Please pick another." };
    }
  }

  return { ok: true, expiresAt };
}

/** Frees a reservation early — e.g. the customer removed it from their
 * cart — rather than making everyone else wait out the full hold. Only
 * releases it if `token` is the one actually holding it, so this can't be
 * used to steal or clear someone else's hold. Best-effort by design: the
 * hold expires on its own regardless, so a failed release here is never a
 * correctness problem, just a slightly later one. */
export async function releaseReservation(printId: string, number: number, token: string) {
  await prisma.edition.updateMany({
    where: { printId, number, status: "RESERVED", reservationToken: token },
    data: { status: "AVAILABLE", reservedAt: null, reservedUntil: null, reservationToken: null },
  });
}
