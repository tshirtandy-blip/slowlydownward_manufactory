"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sampleCoaData } from "@/lib/coa-template";
import { buildCoaPdf } from "@/lib/coa-pdf";
import { sanitizeCoaHtml, sanitizeCoaCss } from "@/lib/sanitize";

type TemplateData = { name: string; pageSize: string; bodyHtml: string; css: string };

async function requireProductAccess() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "STOCK"].includes(session.user.role)) throw new Error("Not authorised");
  return session;
}

/** Creates or updates this product's OWN Certificate of Authenticity
 * template — an override of the global default (Admin > Settings > COA
 * template), specific to this one print. */
export async function saveProductCoaTemplate(
  printId: string,
  data: TemplateData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireProductAccess();
  } catch {
    return { ok: false, error: "Not authorised" };
  }

  try {
    const fields = {
      name: data.name,
      pageSize: data.pageSize,
      bodyHtml: sanitizeCoaHtml(data.bodyHtml),
      css: sanitizeCoaCss(data.css),
    };
    await prisma.coaTemplate.upsert({
      where: { printId },
      update: fields,
      create: { printId, ...fields },
    });
    revalidatePath(`/admin/products/${printId}/coa`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save the template." };
  }
}

/** Removes this product's override so it goes back to using the global
 * default template. */
export async function deleteProductCoaTemplate(printId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireProductAccess();
  } catch {
    return { ok: false, error: "Not authorised" };
  }

  try {
    await prisma.coaTemplate.deleteMany({ where: { printId } });
    revalidatePath(`/admin/products/${printId}/coa`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't switch back to the default." };
  }
}

/** "Preview PDF" for the per-product editor — uses this product's real
 * title/artist/edition size/paper+print size/image so the preview looks
 * like a real certificate for this print, not a generic placeholder. */
export async function previewProductCoaPdf(
  printId: string,
  data: TemplateData
): Promise<{ ok: true; pdfBase64: string } | { ok: false; error: string }> {
  try {
    await requireProductAccess();
  } catch {
    return { ok: false, error: "Not authorised" };
  }

  try {
    const print = await prisma.print.findUniqueOrThrow({ where: { id: printId } });
    const { item, order } = sampleCoaData(print);
    const pdf = await buildCoaPdf({
      order,
      items: [item],
      templateFor: () => ({
        id: "preview",
        printId,
        name: data.name,
        pageSize: data.pageSize,
        bodyHtml: data.bodyHtml,
        css: data.css,
      }),
    });
    return { ok: true, pdfBase64: pdf.toString("base64") };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't generate a preview PDf." };
  }
}
