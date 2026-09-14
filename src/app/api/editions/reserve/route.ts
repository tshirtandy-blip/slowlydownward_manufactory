import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { reserveEdition } from "@/lib/edition-reservations";
import { getSiteSettings } from "@/lib/site-settings";

const bodySchema = z.object({
  printId: z.string().min(1),
  number: z.number().int().positive(),
  token: z.string().min(8).max(200),
});

// Called when a customer clicks "Add to cart" with a specific edition
// number selected — holds that number for them for a little while (see
// Admin > Settings > Editions) so nobody else can also buy it out from
// under them while they check out.
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { printId, number, token } = parsed.data;

    const print = await prisma.print.findUnique({ where: { id: printId }, select: { editionSize: true } });
    if (!print || print.editionSize === null) {
      return NextResponse.json({ error: "This print doesn't have numbered editions." }, { status: 400 });
    }

    const settings = await getSiteSettings();
    const result = await reserveEdition(printId, number, token, settings.editionReservationMinutes);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    return NextResponse.json({ ok: true, expiresAt: result.expiresAt.toISOString() });
  } catch (err) {
    console.error("Edition reservation failed:", err);
    return NextResponse.json(
      { error: "Something went wrong reserving that number. Please try again." },
      { status: 500 }
    );
  }
}
