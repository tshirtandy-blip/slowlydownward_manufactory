import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Allocates a physical edition to an order item for a given print.
 *
 * Default behaviour: pick a uniformly random AVAILABLE edition for the print.
 * If `requestedNumber` is given and that edition is still AVAILABLE, it is
 * used instead (first-come-first-served — this is called inside a
 * transaction with a row lock so two simultaneous buyers can't get the same
 * copy).
 *
 * Throws if no edition is available (caller should treat the print as sold
 * out and refund / cancel).
 */
export async function allocateEdition(
  tx: Prisma.TransactionClient,
  printId: string,
  requestedNumber?: number | null
) {
  if (requestedNumber) {
    const requested = await tx.edition.findUnique({
      where: { printId_number: { printId, number: requestedNumber } },
    });
    if (requested && requested.status === "AVAILABLE") {
      return tx.edition.update({
        where: { id: requested.id },
        data: { status: "SOLD", soldAt: new Date() },
      });
    }
    // Requested number not available — fall through to random allocation.
  }

  const available = await tx.edition.findMany({
    where: { printId, status: "AVAILABLE" },
    select: { id: true },
  });
  if (available.length === 0) {
    throw new Error(`No available editions left for print ${printId}`);
  }
  const pick = available[Math.floor(Math.random() * available.length)];

  return tx.edition.update({
    where: { id: pick.id },
    data: { status: "SOLD", soldAt: new Date() },
  });
}

export function editionSummary(available: number, total: number) {
  if (available === 0) return "Sold out";
  if (available === total) return `Edition of ${total}`;
  return `${available} of ${total} remaining`;
}
