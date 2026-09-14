import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/edition-reservations";

// Powers the print picker on Admin > Orders > New manual order — once staff
// pick a print, this returns which numbers are actually free to hand-pick
// right now. Not under /admin/* so next-auth's middleware doesn't already
// guard it — checked here instead (see /api/admin/live-stats for the same
// pattern).
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccess(session.user.role as any, "orders")) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const printId = new URL(req.url).searchParams.get("printId");
  if (!printId) {
    return NextResponse.json({ error: "Missing printId" }, { status: 400 });
  }

  const print = await prisma.print.findUnique({ where: { id: printId } });
  if (!print) {
    return NextResponse.json({ error: "That print doesn't exist any more." }, { status: 404 });
  }

  if (print.editionSize === null) {
    return NextResponse.json({
      isOpenEdition: true,
      available: [],
      editionSize: null,
      title: print.title,
      priceMinor: print.priceMinor,
      currency: print.currency,
    });
  }

  // A browsing hold that's simply timed out shouldn't still look taken here.
  await releaseExpiredReservations(prisma, printId);

  const editions = await prisma.edition.findMany({
    where: { printId, status: "AVAILABLE" },
    orderBy: { number: "asc" },
    select: { number: true },
  });

  return NextResponse.json({
    isOpenEdition: false,
    available: editions.map((e) => e.number),
    editionSize: print.editionSize,
    title: print.title,
    priceMinor: print.priceMinor,
    currency: print.currency,
  });
}
