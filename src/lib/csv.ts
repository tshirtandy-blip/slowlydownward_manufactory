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

/** Parses a whole CSV file's text into rows of fields, the way `splitCsvLine`
 * handles a single line but for the entire file at once — which matters
 * because a quoted field can legitimately contain a real newline (a
 * multi-paragraph description pasted in from a rich-text editor or an
 * old Shopify export, most commonly), and splitting the file into lines
 * *before* parsing quotes — which every importer here used to do —
 * chops a field like that into several bogus "rows" the moment it hits
 * one of those embedded newlines. This walks the whole text once,
 * tracking quote state across newlines instead of resetting it at each
 * one, so a quoted field's own line breaks stay inside that one field
 * and its one row. CRLF and lone-CR line endings are both normalised to
 * LF first so neither ends up embedded in a field. */
export function parseCsvText(text: string): string[][] {
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else {
      field += ch;
    }
  }
  // The last field/row of a file that doesn't end with a trailing newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** True for a row that's entirely empty fields — a wholly blank line, or
 * (just as common from a spreadsheet export) a line of nothing but
 * commas. Callers skip these silently rather than reporting them as a
 * row with a missing required column. */
export function isBlankRow(fields: string[]): boolean {
  return fields.every((f) => f.trim() === "");
}

/** Splits a whole file into a lowercased header row and the remaining data
 * rows (each already split into fields) — see parseCsvText for how
 * multi-line quoted fields are handled. Genuinely blank rows are dropped
 * entirely rather than counted (or numbered) as data rows. */
export function parseCsvRows(text: string): { header: string[]; lines: string[][] } {
  const allRows = parseCsvText(text).filter((r) => !isBlankRow(r));
  if (allRows.length === 0) return { header: [], lines: [] };
  const header = allRows[0].map((h) => h.trim().toLowerCase());
  const lines = allRows.slice(1);
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
