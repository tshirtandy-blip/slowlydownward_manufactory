"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

export async function addMediumOption(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const last = await prisma.mediumOption.findFirst({ orderBy: { sortOrder: "desc" } });

  await prisma.mediumOption.upsert({
    where: { name },
    update: {},
    create: { name, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });

  revalidatePath("/admin/settings/mediums");
  revalidatePath("/admin/products");
}

export async function deleteMediumOption(id: string) {
  await requireAdmin();
  await prisma.mediumOption.delete({ where: { id } });
  revalidatePath("/admin/settings/mediums");
  revalidatePath("/admin/products");
}
