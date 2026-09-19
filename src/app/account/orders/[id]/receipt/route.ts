import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildReceiptPdf } from "@/lib/receipt-pdf";

/** Lets a signed-in customer download a PDF receipt for one of their own
 * orders — see /account/orders' "Download receipt" link. Unlike the
 * admin commercial-invoice route (src/app/admin/(protected)/orders/[id]/
 * commercial-invoice/route.ts), this checks the session belongs to the
 * CUSTOMER who placed the order, not an admin/packer, and serves the PDF
 * as `attachment` (a real download) rather than `inline`. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const customerId = session?.user && (session.user as any).role === "CUSTOMER" ? (session.user as any).id : null;
  if (!customerId) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: { include: { print: true, edition: true } },
      customer: { select: { email: true, firstName: true, lastName: true } },
    },
  });
  if (!order || order.customerId !== customerId) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const pdf = await buildReceiptPdf({ order, items: order.items, customer: order.customer });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${order.orderNumber}-receipt.pdf"`,
    },
  });
}
