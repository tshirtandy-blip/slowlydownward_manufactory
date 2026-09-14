import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoreAddress } from "@/lib/store-address";
import { buildCommercialInvoicePdf } from "@/lib/commercial-invoice";

/** Lets staff view/download the commercial invoice for an order directly —
 * this is the same document generated automatically for UPS's paperless
 * customs upload (see src/app/admin/(protected)/pack/actions.ts), kept
 * available here as a shop record and as a manual fallback (print it and
 * put a copy in the parcel, or attach it by hand in another carrier's
 * portal) if the automatic electronic upload ever fails. This route sits
 * under /admin/, so middleware's RBAC already covers it, but it checks its
 * own session anyway since a Route Handler can be requested directly. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "PACKER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: { include: { print: true } } },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const address = order.shippingAddress as any;
  if (!address) {
    return NextResponse.json({ error: "No shipping address captured for this order yet." }, { status: 400 });
  }

  const shipFrom = getStoreAddress();
  const shipTo = {
    name: order.shippingName ?? "Customer",
    line1: address.line1 ?? "",
    line2: address.line2 ?? undefined,
    city: address.city ?? "",
    postalCode: address.postal_code ?? "",
    countryCode: address.country ?? "GB",
  };

  const pdf = await buildCommercialInvoicePdf({ order, shipFrom, shipTo });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${order.orderNumber}-commercial-invoice.pdf"`,
    },
  });
}
