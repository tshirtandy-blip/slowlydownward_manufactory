/**
 * Minimal CSV helpers shared by the importers under Admin > Settings >
 * Import (see src/lib/imports/*.ts). Handles quoted fields — embedded
 * commas, escaped quotes — well enough for a small, hand-maintained or
 * spreadsheet-exported file; not a general-purpose CSV library. The same
 * logic already existed once, privately, in src/lib/royal-mail-rates.ts —
 * duplicated there rather than refactored to use this, so as not to touch
 * an already-working import while adding these new ones.
 */

export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Splits a whole file into a lowercased header row and the remaining data
 * rows (each already split into fields), skipping blank lines. */
export function parseCsvRows(text: string): { header: string[]; lines: string[][] } {
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) return { header: [], lines: [] };
  const header = splitCsvLine(rawLines[0]).map((h) => h.trim().toLowerCase());
  const lines = rawLines.slice(1).map(splitCsvLine);
  return { header, lines };
}

/** Parses a date cell accepting either ISO (2024-03-05) or UK-style
 * (05/03/2024 or 05-03-2024) day/month/year — the two formats a
 * spreadsheet export is realistically going to produce. Returns null for
 * anything else rather than guessing. */
export function parseCsvDate(raw: string | undefined | null): Date | null {
  const value = raw?.trim();
  if (!value) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return isNaN(d.getTime()) ? null : d;
  }

  const uk = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (uk) {
    const day = Number(uk[1]);
    const month = Number(uk[2]);
    const year = Number(uk[3]);
    const d = new Date(Date.UTC(year, month - 1, day));
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function yesNoCell(fields: string[], colIndex: number): boolean {
  if (colIndex < 0) return false;
  const v = fields[colIndex]?.trim().toLowerCase();
  return v === "yes" || v === "y" || v === "true" || v === "1";
}

export function stringCell(fields: string[], colIndex: number): string | null {
  if (colIndex < 0) return null;
  const v = fields[colIndex]?.trim();
  return v ? v : null;
}
