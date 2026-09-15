"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { getImportType, type ImportSummary } from "@/lib/imports/registry";

// A products import fetches and re-hosts each row's image, which can add
// up over a big file — raises the ceiling Vercel gives this action as far
// as the hosting plan allows (a Hobby plan caps well below this regardless
// of what's set here, which is the main reason very large image-heavy
// files are better split into a few smaller uploads — see the note on the
// import page itself).
export const maxDuration = 300;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

export async function importCsv(
  typeKey: string,
  csvText: string
): Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }> {
  await requireAdmin();

  const type = getImportType(typeKey);
  if (!type) return { ok: false, error: "Unknown import type." };

  const { rows, errors: parseErrors } = type.parse(csvText);
  if (rows.length === 0) {
    return { ok: false, error: parseErrors[0] ?? "No valid rows found in that file." };
  }

  const summary = await type.apply(rows);
  summary.errors = [...parseErrors, ...summary.errors];

  revalidatePath("/admin/customers");
  revalidatePath("/admin/products");
  revalidatePath("/admin/orders");

  return { ok: true, summary };
}
