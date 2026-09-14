"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SITE_SETTINGS_ID } from "@/lib/site-settings";
import { FONT_OPTIONS, isCustomFontKey } from "@/lib/fonts";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

const BUILT_IN_KEYS = new Set(FONT_OPTIONS.map((f) => f.key));

// A chosen font is valid if it's one of the built-in system stacks, or it
// names a custom font that's actually been uploaded (see customFontKey in
// src/lib/fonts.ts) — anything else (a stale/deleted upload, a tampered
// request) quietly falls back to the site default rather than saving
// something nothing can resolve.
async function isValidFontKey(key: string): Promise<boolean> {
  if (BUILT_IN_KEYS.has(key as any)) return true;
  if (isCustomFontKey(key)) {
    const id = key.slice("custom-".length);
    const exists = await prisma.customFont.findUnique({ where: { id }, select: { id: true } });
    return !!exists;
  }
  return false;
}

export async function updateTypography(formData: FormData) {
  await requireAdmin();

  const headingFontRaw = String(formData.get("headingFont") || "");
  const bodyFontRaw = String(formData.get("bodyFont") || "");
  const [headingValid, bodyValid] = await Promise.all([
    isValidFontKey(headingFontRaw),
    isValidFontKey(bodyFontRaw),
  ]);
  const headingFont = headingValid ? headingFontRaw : "serif-times";
  const bodyFont = bodyValid ? bodyFontRaw : "sans-helvetica";

  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: { headingFont, bodyFont },
    create: { id: SITE_SETTINGS_ID, headingFont, bodyFont },
  });

  // Fonts are applied on every page via the root layout, so this needs a
  // blanket revalidation rather than one specific path.
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings/typography");
}

const VALID_FALLBACKS = new Set(["serif", "sans-serif", "monospace", "system-ui"]);

/** Uploads (via /api/admin/upload-font, called from the client first) are
 * just a file sitting in storage until this saves a named row pointing at
 * it — that's what actually makes it choosable in the dropdowns above. */
export async function addCustomFont(formData: FormData) {
  await requireAdmin();

  const label = String(formData.get("label") || "").trim();
  const fileUrl = String(formData.get("fileUrl") || "").trim();
  const format = String(formData.get("format") || "").trim();
  const fallbackRaw = String(formData.get("fallback") || "sans-serif").trim();
  const fallback = VALID_FALLBACKS.has(fallbackRaw) ? fallbackRaw : "sans-serif";

  if (!fileUrl || !format) throw new Error("Please upload a font file first.");
  if (!label) throw new Error("Please give the font a name.");

  const maxOrder = await prisma.customFont.aggregate({ _max: { sortOrder: true } });
  await prisma.customFont.create({
    data: { label, fileUrl, format, fallback, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/settings/typography");
}

/** Removing an uploaded font never touches SiteSettings — if heading or
 * body text is currently set to use it, fontStackFor() falls back to the
 * site default the moment it can no longer find this row, rather than the
 * page breaking. */
export async function deleteCustomFont(id: string) {
  await requireAdmin();

  await prisma.customFont.delete({ where: { id } });

  revalidatePath("/", "layout");
  revalidatePath("/admin/settings/typography");
}
