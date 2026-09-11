"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export async function createPrint(formData: FormData) {
  await requireStockAccess();

  const title = String(formData.get("title"));
  const editionSize = Number(formData.get("editionSize"));
  const priceMinor = Math.round(Number(formData.get("price")) * 100);
  const description = String(formData.get("description") || "");
  const technique = String(formData.get("technique") || "");
  const dimensions = String(formData.get("dimensions") || "");
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
      dimensions: dimensions || undefined,
      year,
      primaryImageUrl: primaryImageUrl || undefined,
      published,
      editions: {
        create: Array.from({ length: editionSize }).map((_, i) => ({ number: i + 1 })),
      },
    },
  });

  revalidatePath("/admin/stock");
  redirect(`/admin/stock/${print.id}`);
}

export async function updateEditionLocation(editionId: string, locationCode: string) {
  await requireStockAccess();

  const code = locationCode.trim().toUpperCase();
  const location = code
    ? await prisma.stockLocation.upsert({
        where: { code },
        update: {},
        create: { code },
      })
    : null;

  await prisma.edition.update({
    where: { id: editionId },
    data: { locationId: location?.id ?? null },
  });

  revalidatePath("/admin/stock");
}

export async function updateEditionStatus(editionId: string, status: "AVAILABLE" | "WITHHELD" | "DAMAGED") {
  await requireStockAccess();
  await prisma.edition.update({ where: { id: editionId }, data: { status } });
  revalidatePath("/admin/stock");
}

export async function togglePublished(printId: string, published: boolean) {
  await requireStockAccess();
  await prisma.print.update({ where: { id: printId }, data: { published } });
  revalidatePath("/admin/stock");
  revalidatePath("/");
}
