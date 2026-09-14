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

export async function updateHeaderSettings(formData: FormData) {
  await requireAdmin();

  const logoType = String(formData.get("logoType")) === "IMAGE" ? "IMAGE" : String(formData.get("logoType")) === "NONE" ? "NONE" : "TEXT";
  const logoText = String(formData.get("logoText") || "").trim();
  const logoImageUrl = String(formData.get("logoImageUrl") || "").trim();
  const logoPositionRaw = String(formData.get("logoPosition"));
  const logoPosition = logoPositionRaw === "CENTER" ? "CENTER" : logoPositionRaw === "RIGHT" ? "RIGHT" : "LEFT";

  // Clamp to a sane range so a stray value can't shrink the logo to nothing
  // or blow it up off the page.
  const logoScaleRaw = Number(formData.get("logoScale"));
  const logoScale = Number.isFinite(logoScaleRaw) ? Math.min(300, Math.max(25, Math.round(logoScaleRaw))) : 100;

  const showCartIcon = formData.get("showCartIcon") === "on";
  const cartIconUrl = String(formData.get("cartIconUrl") || "").trim();
  const showAccountIcon = formData.get("showAccountIcon") === "on";
  const accountIconUrl = String(formData.get("accountIconUrl") || "").trim();
  const showCurrencySelector = formData.get("showCurrencySelector") === "on";

  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: {
      logoType,
      logoText: logoText || null,
      logoImageUrl: logoImageUrl || null,
      logoPosition,
      logoScale,
      showCartIcon,
      cartIconUrl: cartIconUrl || null,
      showAccountIcon,
      accountIconUrl: accountIconUrl || null,
      showCurrencySelector,
    },
    create: {
      id: SITE_SETTINGS_ID,
      logoType,
      logoText: logoText || null,
      logoImageUrl: logoImageUrl || null,
      logoPosition,
      logoScale,
      showCartIcon,
      cartIconUrl: cartIconUrl || null,
      showAccountIcon,
      accountIconUrl: accountIconUrl || null,
      showCurrencySelector,
    },
  });

  // The header renders on every storefront route via the root layout, so
  // this needs a blanket revalidation rather than one specific path.
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings/header");
}

/** Clears the logo entirely — the dedicated action for the "remove logo"
 * button, distinct from just leaving the text field blank (which would
 * fall back to the default "Slowly Downward" text). */
export async function removeLogo() {
  await requireAdmin();

  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: { logoType: "NONE", logoText: null, logoImageUrl: null },
    create: { id: SITE_SETTINGS_ID, logoType: "NONE", logoText: null, logoImageUrl: null },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/settings/header");
}
