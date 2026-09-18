import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildCoaPdf } from "@/lib/coa-pdf";
import { resolveCoaTemplate } from "@/lib/coa-template";

/** Lets staff view/re-download an order's Certificate(s) of Authenticity
 * directly from the order page — the same document generated from the
 * packing queue's "Print COA" button (see generateCoaPdf in
 * src/app/admin/(protected)/pack/actions.ts), kept available here as a
 * manual fallback/reprint if a physical copy is lost or damaged after the
 * order's already been packed. Purely a read: unlike generateCoaPdf, this
 * does NOT stamp coaPrintedAt/coaPrintedByUserId — that's the packing
 * queue's own record of when the certificate was first handed to a
 * packer, not touched by a later reprint. This route sits under /admin/,
 * so middleware's RBAC already covers it, but it checks its own session
 * anyway since a Route Handler can be requested directly. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "PACKER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: { include: { print: true, edition: true } } },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.items.length === 0) {
    return NextResponse.json({ error: "This order has no items." }, { status: 400 });
  }

  try {
    const pdf = await buildCoaPdf({
      order,
      items: order.items,
      templateFor: (printId) => resolveCoaTemplate(printId),
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${order.orderNumber}-certificate-of-authenticity.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't generate the Certificate of Authenticity." },
      { status: 500 }
    );
  }
}
