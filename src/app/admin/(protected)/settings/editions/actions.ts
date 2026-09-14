"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SITE_SETTINGS_ID } from "@/lib/site-settings";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

export async function updateEditionSettings(formData: FormData) {
  await requireAdmin();

  const minutesRaw = Number(formData.get("editionReservationMinutes"));
  const editionReservationMinutes = Number.isFinite(minutesRaw)
    ? Math.min(60, Math.max(1, Math.round(minutesRaw)))
    : 5;
  const editionPickerNote = String(formData.get("editionPickerNote") || "").trim();

  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: { editionReservationMinutes, editionPickerNote },
    create: { id: SITE_SETTINGS_ID, editionReservationMinutes, editionPickerNote },
  });

  revalidatePath("/admin/settings/editions");
}
