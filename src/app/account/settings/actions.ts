"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getCustomerId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const customer = session?.user && (session.user as any).role === "CUSTOMER" ? session.user : null;
  return customer ? (customer as any).id : null;
}

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateProfile(input: {
  firstName: string;
  lastName: string;
  phone: string;
  marketingOptIn: boolean;
}): Promise<ActionResult> {
  const customerId = await getCustomerId();
  if (!customerId) return { ok: false, error: "You need to be signed in." };
  try {
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        firstName: input.firstName.trim() || null,
        lastName: input.lastName.trim() || null,
        phone: input.phone.trim() || null,
        marketingOptIn: input.marketingOptIn,
      },
    });
    revalidatePath("/account/settings");
    return { ok: true };
  } catch (err) {
    console.error("updateProfile failed:", err);
    return { ok: false, error: "Something went wrong saving your details." };
  }
}

export async function changePassword(input: { currentPassword: string; newPassword: string }): Promise<ActionResult> {
  const customerId = await getCustomerId();
  if (!customerId) return { ok: false, error: "You need to be signed in." };
  if (input.newPassword.length < 8) return { ok: false, error: "New password must be at least 8 characters." };

  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer?.passwordHash) return { ok: false, error: "No password set on this account yet." };

    const valid = await bcrypt.compare(input.currentPassword, customer.passwordHash);
    if (!valid) return { ok: false, error: "Current password is incorrect." };

    const passwordHash = await bcrypt.hash(input.newPassword, 10);
    await prisma.customer.update({ where: { id: customerId }, data: { passwordHash } });
    return { ok: true };
  } catch (err) {
    console.error("changePassword failed:", err);
    return { ok: false, error: "Something went wrong changing your password." };
  }
}
