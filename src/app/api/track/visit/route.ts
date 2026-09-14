import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  visitorId: z.string().min(1).max(100),
  cartItemCount: z.number().int().min(0).max(1000).default(0),
});

// Called every ~45s by src/components/VisitorTracker.tsx while someone has
// the storefront open. Deliberately tiny and best-effort: never blocks or
// breaks the page it's called from if it fails.
export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { visitorId, cartItemCount } = parsed.data;

    await prisma.visitor.upsert({
      where: { id: visitorId },
      update: { cartItemCount },
      create: { id: visitorId, cartItemCount },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Visit tracking failed:", err);
    // Never a hard failure from the caller's point of view — this is a
    // background beacon, not something a page should react to.
    return NextResponse.json({ ok: false });
  }
}
