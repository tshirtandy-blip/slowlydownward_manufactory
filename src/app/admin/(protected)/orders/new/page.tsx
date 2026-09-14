import { prisma } from "@/lib/prisma";
import { getShippingZones } from "@/lib/shipping";
import { ManualOrderForm } from "@/components/admin/ManualOrderForm";

export const dynamic = "force-dynamic";

export default async function NewManualOrderPage() {
  // Deliberately every print, published or not — the whole point of this
  // page is selling something that isn't (or isn't yet) on the storefront.
  const prints = await prisma.print.findMany({
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      published: true,
      editionSize: true,
      priceMinor: true,
      currency: true,
    },
  });
  const zones = await getShippingZones();

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl mb-2">New manual order</h1>
      <p className="text-sm text-stone mb-8">
        For selling archive or current prints you have in stock but haven't listed on the storefront — pick the
        exact edition number(s), and the client gets emailed a payment link. The number(s) are held for them
        until they pay or you cancel the order.
      </p>
      <ManualOrderForm prints={prints} zones={zones} />
    </div>
  );
}
