import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

// Order statuses that mean the customer actually owns the item — excludes
// PENDING_PAYMENT (not paid yet), CANCELLED and REFUNDED (no longer theirs).
const OWNED_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PACKING,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
];

export type CollectionPiece = {
  orderItemId: string;
  printId: string;
  printTitle: string;
  printSlug: string;
  printImageUrl: string | null;
  editionNumber: number | null;
  editionSize: number | null;
  orderNumber: string;
  purchasedAt: Date;
};

/** Every print a customer has actually paid for, newest first — this is
 * what powers the "My Collection" gallery on their account homepage
 * (src/app/account/page.tsx). An open-edition item (editionNumber null)
 * still shows, just without a number badge. */
export async function getCustomerCollection(customerId: string): Promise<CollectionPiece[]> {
  const items = await prisma.orderItem.findMany({
    where: {
      order: { customerId, status: { in: OWNED_STATUSES } },
    },
    include: {
      print: true,
      edition: true,
      order: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return items.map((item) => ({
    orderItemId: item.id,
    printId: item.printId,
    printTitle: item.print.title,
    printSlug: item.print.slug,
    printImageUrl: item.print.primaryImageUrl,
    editionNumber: item.edition?.number ?? item.requestedEditionNumber ?? null,
    editionSize: item.print.editionSize,
    orderNumber: item.order.orderNumber,
    purchasedAt: item.createdAt,
  }));
}

/** Every paid copy this customer owns of one specific print — used by the
 * print page (src/app/prints/[slug]/page.tsx) to list which edition
 * number(s) they hold when viewing it via "My Collection". */
export async function getCustomerPiecesForPrint(customerId: string, printId: string): Promise<CollectionPiece[]> {
  const all = await getCustomerCollection(customerId);
  return all.filter((piece) => piece.printId === printId);
}

/** Whether this customer owns at least one paid copy of this print — used
 * by the print detail page (src/app/prints/[slug]/page.tsx) to let past
 * buyers keep viewing a print even after it's been unpublished (e.g. a
 * sold-out limited edition taken off the shop), so "My Collection" links
 * never lead to a dead page. */
export async function customerOwnsPrint(customerId: string, printId: string): Promise<boolean> {
  const count = await prisma.orderItem.count({
    where: {
      printId,
      order: { customerId, status: { in: OWNED_STATUSES } },
    },
  });
  return count > 0;
}
