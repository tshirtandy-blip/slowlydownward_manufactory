"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SITE_SETTINGS_ID } from "@/lib/site-settings";
import { slugify, RESERVED_SLUGS } from "@/lib/slugify";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

// The footer renders on every storefront route (each page fetches it itself
// — see src/lib/footer.ts), so there's no one path to revalidate.
function revalidateFooter() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings/footer");
}

/** Saves the two text columns, the "Information" column's own heading, and
 * the bottom bar's copyright name / badge text — everything on the footer
 * except the list of links itself (see updateFooterLinks below). */
export async function updateFooterContent(formData: FormData) {
  await requireAdmin();

  const field = (name: string, fallback: string) => String(formData.get(name) || "").trim() || fallback;

  const data = {
    footerColumn1Heading: field("footerColumn1Heading", "The Archive"),
    footerColumn1Body: String(formData.get("footerColumn1Body") || "").trim(),
    footerColumn2Heading: field("footerColumn2Heading", "Excuse Me"),
    footerColumn2Body: String(formData.get("footerColumn2Body") || "").trim(),
    footerLinksHeading: field("footerLinksHeading", "Information"),
    footerCopyrightName: field("footerCopyrightName", "Slowly Downward"),
    footerBadgeText: field("footerBadgeText", "Stripe secure checkout"),
  };

  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: data,
    create: { id: SITE_SETTINGS_ID, ...data },
  });

  revalidateFooter();
}

/** Syncs the footer's link list to exactly what was submitted — label text
 * and order for each row still present (the label is independent of the
 * underlying page's own title, so it can read differently in the footer
 * than the page's own heading if you want), and removes any existing link
 * left out of the submission (the "Remove" button in the editor works by
 * dropping a row from the list client-side, then this save makes it
 * permanent — same as several other list editors in this app). This never
 * touches the underlying Page rows themselves, only which of them are
 * linked from the footer. Adding a brand new page is a separate action —
 * see addFooterLink below. */
export async function updateFooterLinks(formData: FormData) {
  await requireAdmin();

  let rows: { id?: string; label?: string }[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("links") || "[]"));
    if (Array.isArray(parsed)) rows = parsed;
  } catch {
    return; // malformed request — leave the links exactly as they are
  }

  const kept = rows.filter((r) => r.id && r.label?.trim());
  const keptIds = kept.map((r) => r.id!);

  await prisma.$transaction([
    prisma.footerLink.deleteMany({ where: { id: { notIn: keptIds } } }),
    ...kept.map((r, i) => prisma.footerLink.update({ where: { id: r.id }, data: { label: r.label!.trim(), sortOrder: i } })),
  ]);

  revalidateFooter();
}

/** Creates a brand-new page AND links it from the footer in one step — the
 * "add a page" ability this screen offers, rather than needing to create
 * the page in Admin > Pages first and separately add a footer link for it.
 * Sends the admin straight to the new page's content editor, since a
 * freshly-created page has no content yet. */
export async function addFooterLink(formData: FormData) {
  await requireAdmin();

  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Title is required");

  const slug = slugify(title);
  if (!slug || RESERVED_SLUGS.has(slug)) {
    throw new Error(`"/${slug}" isn't available as a page address — try a different title.`);
  }
  if (await prisma.page.findUnique({ where: { slug } })) {
    throw new Error("A page with that address already exists.");
  }

  const maxOrder = await prisma.footerLink.aggregate({ _max: { sortOrder: true } });

  const page = await prisma.page.create({
    data: { title, slug, status: "PUBLISHED", blocks: [] },
  });
  await prisma.footerLink.create({
    data: { pageId: page.id, label: title, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });

  revalidateFooter();
  revalidatePath("/admin/pages");
  redirect(`/admin/pages/${page.id}`);
}
