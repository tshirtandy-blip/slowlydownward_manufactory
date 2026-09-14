import { NextResponse } from "next/server";
import { z } from "zod";
import { releaseReservation } from "@/lib/edition-reservations";

const bodySchema = z.object({
  printId: z.string().min(1),
  number: z.number().int().positive(),
  token: z.string().min(8).max(200),
});

// Called when a customer removes a reserved edition from their cart, so the
// number goes back up for grabs straight away instead of everyone else
// having to wait out the rest of its hold. Best-effort on purpose — the
// hold expires on its own regardless, so failing quietly here is never a
// correctness problem, just a slightly later one.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: true });
    await releaseReservation(parsed.data.printId, parsed.data.number, parsed.data.token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Edition release failed:", err);
    return NextResponse.json({ ok: true });
  }
}
