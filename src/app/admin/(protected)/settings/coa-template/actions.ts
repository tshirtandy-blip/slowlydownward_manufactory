"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGlobalCoaTemplate, sampleCoaData } from "@/lib/coa-template";
import { buildCoaPdf } from "@/lib/coa-pdf";
import { sanitizeCoaHtml, sanitizeCoaCss } from "@/lib/sanitize";

type TemplateData = { name: string; pageSize: string; bodyHtml: string; css: string };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

/** Saves the single global default Certificate of Authenticity template
 * (printId null) — the one every product uses unless it has its own
 * override (see products/[printId]/coa/actions.ts). Auto-creates the row
 * if it doesn't exist yet (getGlobalCoaTemplate's usual lazy-singleton
 * behaviour, same as SiteSettings). */
export async function saveGlobalCoaTemplate(data: TemplateData): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Not authorised" };
  }

  const fields = {
    name: data.name,
    pageSize: data.pageSize,
    bodyHtml: sanitizeCoaHtml(data.bodyHtml),
    css: sanitizeCoaCss(data.css),
  };

  try {
    // Ensures a real row exists first (getGlobalCoaTemplate lazily creates
    // one the first time it's needed, same as getSiteSettings). Its
    // fallback id "default" only appears if the database was briefly
    // unreachable during that read — retried as a fresh create below in
    // that rare case, rather than failing the save outright.
    const current = await getGlobalCoaTemplate();
    if (current.id === "default") {
      await prisma.coaTemplate.create({ data: { printId: null, ...fields } });
    } else {
      await prisma.coaTemplate.update({ where: { id: current.id }, data: fields });
    }

    revalidatePath("/admin/settings/coa-template");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save the template." };
  }
}

/** Renders a one-off PDF from whatever's currently in the editor (not yet
 * saved) using fabricated sample data — the "Preview PDF" button's exact,
 * byte-true proof of what the printed certificate will look like, since
 * the on-screen iframe preview uses a different rendering engine. */
export async function previewCoaPdf(data: TemplateData): Promise<{ ok: true; pdfBase64: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Not authorised" };
  }

  try {
    const { item, order } = sampleCoaData({
      id: "sample-print",
      title: "Sample Print",
      artist: "Stanley Donwood",
      editionSize: 200,
      paperSize: "A2 (420 x 594mm)",
      imageSize: "300 x 400mm",
      primaryImageUrl: null,
    });
    const pdf = await buildCoaPdf({
      order,
      items: [item],
      templateFor: () => ({
        id: "preview",
        printId: null,
        name: data.name,
        pageSize: data.pageSize,
        bodyHtml: data.bodyHtml,
        css: data.css,
      }),
    });
    return { ok: true, pdfBase64: pdf.toString("base64") };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't generate a preview PDF." };
  }
}
