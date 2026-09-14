import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({ email: z.string().email() });

// Used at the cart page: before someone checks out as a guest, this tells
// the page whether that email already belongs to a registered account (one
// with a password set — see Customer.passwordHash), so the page can steer
// them to sign in instead of quietly placing a guest order against an email
// that isn't provably theirs. Deliberately reveals nothing else about the
// account (not even whether the email exists as a guest-only customer) —
// just the one yes/no this decision needs.
export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const customer = await prisma.customer.findUnique({
      where: { email: parsed.data.email.toLowerCase().trim() },
      select: { passwordHash: true },
    });
    return NextResponse.json({ registered: !!customer?.passwordHash });
  } catch (err) {
    console.error("check-email failed:", err);
    // Fail open: if this check itself breaks, guest checkout should still
    // work exactly as it always has, not be blocked by this side-feature.
    return NextResponse.json({ registered: false });
  }
}
