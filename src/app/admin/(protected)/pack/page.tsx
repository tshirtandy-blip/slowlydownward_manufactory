import { prisma } from "@/lib/prisma";
import { PackQueueList, type PackQueueRow } from "@/components/admin/PackQueueList";
import { getCarrierCosts } from "./actions";

export const dynamic = "force-dynamic";

export default async function PackPage() {
  const orders = await prisma.order.findMany({
    where: { status: "PAID" },
    orderBy: { createdAt: "asc" },
    include: { items: { include: { print: true, edition: true } } },
  });

  const costs = await Promise.all(orders.map((o) => getCarrierCosts(o.id)));

  // Flattened into plain, serializable rows for PackQueueList (a Client
  // Component) — it freezes this snapshot in state on mount so a packed
  // order doesn't vanish from view the moment Next.js re-runs this page
  // behind the scenes (see the comment on PackQueueList itself).
  const rows: PackQueueRow[] = orders.map((order, i) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    shippingName: order.shippingName,
    currency: order.currency,
    items: order.items.map((item) => ({
      id: item.id,
      title: item.print.title,
      editionLabel: item.edition
        ? `#${item.edition.number}`
        : item.print.editionSize === null
        ? "Open edition"
        : "Not assigned",
      drawerLocation: item.print.drawerLocation,
    })),
    costs: {
      royalMail: costs[i].royalMail,
      royalMailError: costs[i].royalMailError,
      ups: costs[i].ups,
      upsError: costs[i].upsError,
      customsPlaceholder: costs[i].customsPlaceholder,
      requiresCustoms: costs[i].requiresCustoms,
      defaultDims: costs[i].defaultDims,
      defaultCustomsValueMinor: costs[i].defaultCustomsValueMinor,
    },
  }));

  return (
    <div>
      <h1 className="font-display text-2xl mb-2">Packing queue</h1>
      <p className="text-stone text-sm mb-8">
        {orders.length} order{orders.length === 1 ? "" : "s"} waiting to be packed. Pick a carrier for each — both
        costs are calculated from the order's actual weight, where connected.
      </p>

      <PackQueueList initialOrders={rows} />
    </div>
  );
}
