import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailConfigured } from "@/lib/integrations/resend";
import { renderWelcomeEmail } from "@/lib/email-templates";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || "Invalid request" }, { status: 400 });
    }
    const { email, password, firstName, lastName } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.customer.findUnique({ where: { email: normalizedEmail } });
    if (existing?.passwordHash) {
      return NextResponse.json(
        { error: "An account with this email already exists — sign in instead." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // If this email already exists as a guest (from a previous order), this
    // claims that same record — and its order history — as their account,
    // rather than creating a disconnected duplicate.
    await prisma.customer.upsert({
      where: { email: normalizedEmail },
      update: { passwordHash, firstName: firstName || undefined, lastName: lastName || undefined },
      create: { email: normalizedEmail, passwordHash, firstName: firstName || null, lastName: lastName || null },
    });

    // Best-effort — a failed welcome email shouldn't stop the account from
    // being created; they can still sign in and use it either way.
    if (emailConfigured()) {
      try {
        const { subject, html } = await renderWelcomeEmail({ customerName: firstName || "there" });
        await sendEmail({ to: normalizedEmail, subject, html });
      } catch (err) {
        console.error("Welcome email failed to send:", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Customer registration failed:", err);
    return NextResponse.json({ error: "Something went wrong creating your account. Please try again." }, { status: 500 });
  }
}
