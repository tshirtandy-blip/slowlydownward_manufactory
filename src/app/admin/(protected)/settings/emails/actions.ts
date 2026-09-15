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

/** Sets (or, with a blank url, removes) the logo shown at the top of every
 * transactional email — see emailHeaderHtml in src/lib/email-templates.ts.
 * Separate from the storefront header's own logo (Admin > Settings >
 * Header & branding), since an email always needs a plain hosted image. */
export async function updateEmailLogo(logoUrl: string) {
  await requireAdmin();

  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: { emailLogoUrl: logoUrl.trim() || null },
    create: { id: SITE_SETTINGS_ID, emailLogoUrl: logoUrl.trim() || null },
  });

  revalidatePath("/admin/settings/emails");
}
