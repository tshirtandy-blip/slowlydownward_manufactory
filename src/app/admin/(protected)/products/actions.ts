"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/sanitize";

async function requireStockAccess() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "STOCK"].includes(session.user.role)) {
    throw new Error("Not authorised");
  }
  return session;
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Parses the "Edition size" field, which accepts either a whole number or
 * the word "open" — null means an open edition (not limited or numbered). */
function parseEditionSize(raw: FormDataEntryValue | null): number | null {
  const value = String(raw || "").trim();
  if (value.toLowerCase() === "open") return null;
  return Math.max(1, Math.round(Number(value)) || 1);
}

/** Creates or removes Edition rows so they match a newly-set (numeric)
 * edition size. Growing just adds the missing numbered rows. Shrinking only
 * removes rows from the top of the numbering down, and only when every one
 * of them is still AVAILABLE — if any edition above the new size has
 * already been sold, reserved, withheld, or marked damaged, the size can't
 * safely shrink that far, so those rows (and the size) are left as they are
 * rather than risking losing a real stock record. */
async function reconcileEditionCount(printId: string, newSize: number) {
  const editions = await prisma.edition.findMany({
    where: { printId },
    orderBy: { number: "desc" },
    select: { id: true, number: true, status: true },
  });
  const currentMax = editions.length ? editions[0].number : 0;

  if (newSize > currentMax) {
    await prisma.edition.createMany({
      data: Array.from({ length: newSize - currentMax }).map((_, i) => ({
        printId,
        number: currentMax + i + 1,
      })),
    });
  } else if (newSize < currentMax) {
    const aboveNewSize = editions.filter((e) => e.number > newSize);
    const allRemovable = aboveNewSize.every((e) => e.status === "AVAILABLE");
    if (allRemovable) {
      await prisma.edition.deleteMany({ where: { id: { in: aboveNewSize.map((e) => e.id) } } });
    }
  }
}

export async function createPrint(formData: FormData) {
  await requireStockAccess();

  const title = String(formData.get("title"));
  const editionSize = parseEditionSize(formData.get("editionSize"));
  const priceMinor = Math.round(Number(formData.get("price")) * 100);
  const description = String(formData.get("description") || "");
  const technique = String(formData.get("technique") || "");
  const year = formData.get("year") ? Number(formData.get("year")) : undefined;
  const primaryImageUrl = String(formData.get("imageUrl") || "");
  const published = formData.get("published") === "on";

  const print = await prisma.print.create({
    data: {
      title,
      slug: slugify(title),
      editionSize,
      priceMinor,
      description: description || undefined,
      technique: technique || undefined,
      year,
      primaryImageUrl: primaryImageUrl || undefined,
      published,
      editions: editionSize
        ? { create: Array.from({ length: editionSize }).map((_, i) => ({ number: i + 1 })) }
        : undefined,
    },
  });

  revalidatePath("/admin/products");
  redirect(`/admin/products/${print.id}`);
}

/** Saves the core product fields from a product's own edit page — everything
 * except stock/drawer/edition-level details, which live on the Stock
 * details sub-page instead (see updateDrawerLocation below). Redirects back
 * to the product list on success, same as creating a product does. */
export async function updatePrintDetails(printId: string, formData: FormData) {
  await requireStockAccess();

  const title = String(formData.get("title") || "").trim();
  const artist = String(formData.get("artist") || "").trim();
  // The description comes from a rich-text editor (see RichTextEditor /
  // ProductEditForm) — sanitize before it's ever written, the same as page
  // content blocks, since it renders as real HTML on the public product page.
  const description = sanitizeRichText(String(formData.get("description") || ""));
  const technique = String(formData.get("technique") || "").trim();
  const paperSize = String(formData.get("paperSize") || "").trim();
  const imageSize = String(formData.get("imageSize") || "").trim();
  const medium = String(formData.get("medium") || "").trim();
  const yearRaw = String(formData.get("year") || "").trim();
  const priceRaw = String(formData.get("price") || "").trim();
  const primaryImageUrl = String(formData.get("primaryImageUrl") || "").trim();
  const imageUrlsRaw = String(formData.get("imageUrls") || "[]");

  const weightRaw = String(formData.get("weightGrams") || "").trim();
  const lengthRaw = String(formData.get("lengthCm") || "").trim();
  const widthRaw = String(formData.get("widthCm") || "").trim();
  const heightRaw = String(formData.get("heightCm") || "").trim();
  const customsValueRaw = String(formData.get("customsValue") || "").trim();
  const customsDescription = String(formData.get("customsDescription") || "").trim();
  const customsCode = String(formData.get("customsCode") || "").trim();

  // Blank means "leave it as it is" (the field is always pre-filled with the
  // current value, so blank should only happen from a stripped-down request,
  // not a deliberate clear) — anything else is either "open" or a number.
  const editionSizeRaw = String(formData.get("editionSize") || "").trim();
  const editionSizeUpdate = editionSizeRaw ? parseEditionSize(editionSizeRaw) : undefined;

  let imageUrls: string[] = [];
  try {
    const parsed = JSON.parse(imageUrlsRaw);
    if (Array.isArray(parsed)) imageUrls = parsed.filter((u) => typeof u === "string" && u.trim());
  } catch {
    // Malformed JSON from a tampered request — just drop the gallery rather
    // than fail the whole save.
  }

  await prisma.print.update({
    where: { id: printId },
    data: {
      title: title || undefined,
      artist: artist || undefined,
      description: description || null,
      technique: technique || null,
      paperSize: paperSize || null,
      imageSize: imageSize || null,
      medium: medium || null,
      year: yearRaw ? Number(yearRaw) : null,
      priceMinor: priceRaw ? Math.round(Number(priceRaw) * 100) : undefined,
      primaryImageUrl: primaryImageUrl || null,
      // Always written (even as []) so removing every gallery image actually
      // clears the column, rather than leaving stale entries behind.
      imageUrls: imageUrls as any,
      editionSize: editionSizeUpdate,
      weightGrams: weightRaw ? Math.round(Number(weightRaw)) : null,
      lengthCm: lengthRaw ? Number(lengthRaw) : null,
      widthCm: widthRaw ? Number(widthRaw) : null,
      heightCm: heightRaw ? Number(heightRaw) : null,
      customsValueMinor: customsValueRaw ? Math.round(Number(customsValueRaw) * 100) : null,
      customsDescription: customsDescription || null,
      customsCode: customsCode || null,
    },
  });

  // Switching *to* a number (whether it was previously open or a different
  // number) creates or trims Edition rows to match. Switching to "open"
  // deliberately leaves any existing Edition rows alone — see
  // reconcileEditionCount's own comment for why shrinking is conservative.
  if (typeof editionSizeUpdate === "number") {
    await reconcileEditionCount(printId, editionSizeUpdate);
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${printId}`);
  revalidatePath(`/admin/products/${printId}/stock`);
  revalidatePath("/");
  redirect("/admin/products");
}

/** Sets the single drawer/location for the whole print — all copies of one
 * edition are kept together, so this replaces per-edition location editing. */
export async function updateDrawerLocation(printId: string, code: string) {
  await requireStockAccess();
  await prisma.print.update({
    where: { id: printId },
    data: { drawerLocation: code.trim() || null },
  });
  revalidatePath(`/admin/products/${printId}/stock`);
  revalidatePath(`/admin/products/${printId}/labels`);
}

export async function updateEditionStatus(editionId: string, status: "AVAILABLE" | "WITHHELD" | "DAMAGED") {
  await requireStockAccess();
  await prisma.edition.update({ where: { id: editionId }, data: { status } });
  revalidatePath("/admin/products");
}

export async function togglePublished(printId: string, published: boolean) {
  await requireStockAccess();
  await prisma.print.update({ where: { id: printId }, data: { published } });
  revalidatePath("/admin/products");
  revalidatePath("/");
}
