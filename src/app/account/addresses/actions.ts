"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getCustomerId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const customer = session?.user && (session.user as any).role === "CUSTOMER" ? session.user : null;
  return customer ? (customer as any).id : null;
}

export type AddressInput = {
  label?: string;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
  isDefault?: boolean;
};

type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveAddress(id: string | null, input: AddressInput): Promise<ActionResult> {
  const customerId = await getCustomerId();
  if (!customerId) return { ok: false, error: "You need to be signed in." };
  if (
    !input.fullName.trim() ||
    !input.line1.trim() ||
    !input.city.trim() ||
    !input.postalCode.trim() ||
    !input.countryCode
  ) {
    return { ok: false, error: "Please fill in name, address line 1, city, postcode and country." };
  }

  try {
    if (input.isDefault) {
      // Only one default at a time — clear any existing one first.
      await prisma.address.updateMany({ where: { customerId }, data: { isDefault: false } });
    }
    if (id) {
      const existing = await prisma.address.findUnique({ where: { id } });
      if (!existing || existing.customerId !== customerId) return { ok: false, error: "Address not found." };
      await prisma.address.update({ where: { id }, data: input });
    } else {
      await prisma.address.create({ data: { ...input, customerId } });
    }
    revalidatePath("/account/addresses");
    return { ok: true };
  } catch (err) {
    console.error("saveAddress failed:", err);
    return { ok: false, error: "Something went wrong saving that address." };
  }
}

export async function deleteAddress(id: string): Promise<ActionResult> {
  const customerId = await getCustomerId();
  if (!customerId) return { ok: false, error: "You need to be signed in." };
  try {
    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.customerId !== customerId) return { ok: false, error: "Address not found." };
    await prisma.address.delete({ where: { id } });
    revalidatePath("/account/addresses");
    return { ok: true };
  } catch (err) {
    console.error("deleteAddress failed:", err);
    return { ok: false, error: "Something went wrong deleting that address." };
  }
}

export async function setDefaultAddress(id: string): Promise<ActionResult> {
  const customerId = await getCustomerId();
  if (!customerId) return { ok: false, error: "You need to be signed in." };
  try {
    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.customerId !== customerId) return { ok: false, error: "Address not found." };
    await prisma.$transaction([
      prisma.address.updateMany({ where: { customerId }, data: { isDefault: false } }),
      prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);
    revalidatePath("/account/addresses");
    return { ok: true };
  } catch (err) {
    console.error("setDefaultAddress failed:", err);
    return { ok: false, error: "Something went wrong updating your default address." };
  }
}
