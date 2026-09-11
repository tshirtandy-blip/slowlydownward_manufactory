"use server";

import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

export async function createStaffUser(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name"));
  const email = String(formData.get("email")).toLowerCase().trim();
  const password = String(formData.get("password"));
  const role = String(formData.get("role")) as Role;

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { name, email, passwordHash, role } });

  revalidatePath("/admin/settings/users");
}

export async function toggleUserActive(userId: string, active: boolean) {
  await requireAdmin();
  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/admin/settings/users");
}
