import { prisma } from "@/lib/prisma";
import { splitCsvLine, yesNoCell, stringCell } from "@/lib/csv";

/**
 * Bulk-import for archival client records (Admin > Settings > Import) —
 * see src/lib/imports/registry.ts for how this plugs into the generic
 * importer UI. Upserts by email so re-uploading the same (or a growing)
 * export is safe to do more than once.
 */

export const CLIENTS_CSV_HEADER = "email,first_name,last_name,phone,marketing_opt_in";

export function clientsCsvTemplate(): string {
  return [
    CLIENTS_CSV_HEADER,
    "jane.smith@example.com,Jane,Smith,+44 7700 900123,yes",
    "john.doe@example.com,John,Doe,,no",
  ].join("\n");
}

export type ParsedClientRow = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  marketingOptIn: boolean;
};

export function parseClientsCsv(text: string): { rows: ParsedClientRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: string[] = [];
  if (lines.length === 0) return { rows: [], errors: ["The file is empty."] };

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idx = {
    email: col("email"),
    first: col("first_name"),
    last: col("last_name"),
    phone: col("phone"),
    marketing: col("marketing_opt_in"),
  };
  if (idx.email === -1) {
    return { rows: [], errors: [`The file needs at least an "email" column — found: ${header.join(", ")}`] };
  }

  const seen = new Set<string>();
  const rows: ParsedClientRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]);
    const lineNo = i + 1;
    const email = fields[idx.email]?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      errors.push(`Line ${lineNo}: missing or invalid email — skipped.`);
      continue;
    }
    if (seen.has(email)) {
      errors.push(`Line ${lineNo}: duplicate email (${email}) in this file — only the first was used.`);
      continue;
    }
    seen.add(email);
    rows.push({
      email,
      firstName: stringCell(fields, idx.first),
      lastName: stringCell(fields, idx.last),
      phone: stringCell(fields, idx.phone),
      marketingOptIn: yesNoCell(fields, idx.marketing),
    });
  }
  return { rows, errors };
}

/** Upserts each row by email. An existing client's already-filled-in
 * fields are never blanked out by an empty cell — only used to fill in
 * something that's currently missing — so a partial or messy export can't
 * accidentally erase details added since (e.g. from their own account
 * settings). Never touches passwordHash: importing archival records never
 * grants sign-in access on its own, only a customer's own registration
 * does that (src/app/api/account/register/route.ts). */
export async function applyClientsImport(
  rows: ParsedClientRow[]
): Promise<{ created: number; updated: number; errors: string[] }> {
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const existing = await prisma.customer.findUnique({ where: { email: row.email } });
      if (existing) {
        await prisma.customer.update({
          where: { email: row.email },
          data: {
            firstName: existing.firstName ?? row.firstName ?? undefined,
            lastName: existing.lastName ?? row.lastName ?? undefined,
            phone: existing.phone ?? row.phone ?? undefined,
            marketingOptIn: row.marketingOptIn || existing.marketingOptIn,
          },
        });
        updated++;
      } else {
        await prisma.customer.create({
          data: {
            email: row.email,
            firstName: row.firstName ?? undefined,
            lastName: row.lastName ?? undefined,
            phone: row.phone ?? undefined,
            marketingOptIn: row.marketingOptIn,
          },
        });
        created++;
      }
    } catch (err: any) {
      errors.push(`${row.email}: ${err?.message || "Couldn't save this row."}`);
    }
  }
  return { created, updated, errors };
}
