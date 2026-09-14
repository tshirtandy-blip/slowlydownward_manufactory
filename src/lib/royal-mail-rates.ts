import { prisma } from "@/lib/prisma";

/**
 * Royal Mail's own price list — set up once (typed in, or bulk-imported
 * from a CSV export of your price sheet) and looked up by destination
 * country, weight, and package dimensions. See the RoyalMailRate model for
 * why this exists instead of a live rate lookup like UPS's: Royal Mail's
 * API doesn't offer per-shipment rate shopping, since your price is fixed
 * by contract to a published table.
 */

export type RoyalMailRateRow = {
  id: string;
  service: string;
  countryCode: string | null;
  maxWeightGrams: number;
  maxLengthCm: number | null;
  maxWidthCm: number | null;
  maxHeightCm: number | null;
  priceMinor: number;
  sortOrder: number;
};

export async function getRoyalMailRates(): Promise<RoyalMailRateRow[]> {
  return prisma.royalMailRate.findMany({ orderBy: [{ countryCode: "asc" }, { maxWeightGrams: "asc" }] });
}

export type RoyalMailCost = { amountMinor: number; service: string; overWeight: boolean };

type Parcel = { countryCode: string; weightGrams: number; lengthCm: number; widthCm: number; heightCm: number };

function fits(row: RoyalMailRateRow, parcel: Parcel): boolean {
  if (parcel.weightGrams > row.maxWeightGrams) return false;
  if (row.maxLengthCm != null && parcel.lengthCm > row.maxLengthCm) return false;
  if (row.maxWidthCm != null && parcel.widthCm > row.maxWidthCm) return false;
  if (row.maxHeightCm != null && parcel.heightCm > row.maxHeightCm) return false;
  return true;
}

/**
 * Finds the cheapest price-list row that covers this parcel to this
 * destination. Prefers rows matching the destination country exactly;
 * falls back to catch-all rows (countryCode null, e.g. a general "Rest of
 * world" rate) only when no country-specific row applies at all. If the
 * parcel is bigger/heavier than every matching row, falls back to the
 * largest matching-country (or catch-all) row rather than refusing to
 * quote, flagged as an estimate. Returns null only when there is no row at
 * all for this country and no catch-all row either.
 */
export function getRoyalMailCost(parcel: Parcel, rates: RoyalMailRateRow[]): RoyalMailCost | null {
  const country = parcel.countryCode.toUpperCase();
  const forCountry = rates.filter((r) => r.countryCode?.toUpperCase() === country);
  const catchAll = rates.filter((r) => r.countryCode == null);
  const candidates = forCountry.length > 0 ? forCountry : catchAll;
  if (candidates.length === 0) return null;

  const fitting = candidates.filter((r) => fits(r, parcel));
  if (fitting.length > 0) {
    const cheapest = fitting.reduce((min, r) => (r.priceMinor < min.priceMinor ? r : min));
    return { amountMinor: cheapest.priceMinor, service: cheapest.service, overWeight: false };
  }

  // Nothing covers this parcel's size/weight for this destination — use the
  // largest (by weight limit) row on file as a best-effort estimate.
  const largest = candidates.reduce((max, r) => (r.maxWeightGrams > max.maxWeightGrams ? r : max));
  return { amountMinor: largest.priceMinor, service: largest.service, overWeight: true };
}

// --- CSV import/export -----------------------------------------------

export const ROYAL_MAIL_RATES_CSV_HEADER =
  "country_code,service,max_weight_g,max_length_cm,max_width_cm,max_height_cm,price_gbp";

/** A short example file matching the header above, offered as a download
 * from the settings page so the columns/format are unambiguous before
 * someone builds a real export to match it. */
export function royalMailRatesCsvTemplate(): string {
  return [
    ROYAL_MAIL_RATES_CSV_HEADER,
    "GB,Tracked 48,1000,,,,4.35",
    "GB,Tracked 48,2000,,,,6.85",
    "FR,International Tracked,2000,,,,9.95",
    ",International Tracked,2000,,,,12.50", // blank country_code = catch-all / "rest of world"
  ].join("\n");
}

export function royalMailRatesToCsv(rows: RoyalMailRateRow[]): string {
  const lines = rows.map((r) =>
    [
      r.countryCode ?? "",
      csvEscape(r.service),
      r.maxWeightGrams,
      r.maxLengthCm ?? "",
      r.maxWidthCm ?? "",
      r.maxHeightCm ?? "",
      (r.priceMinor / 100).toFixed(2),
    ].join(",")
  );
  return [ROYAL_MAIL_RATES_CSV_HEADER, ...lines].join("\n");
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Minimal CSV line splitter — handles quoted fields (with embedded commas
 * or escaped quotes) since a service name could contain a comma. Good
 * enough for a small, hand-maintained or spreadsheet-exported price list;
 * not a general-purpose CSV parser. */
function splitCsvLine(line: string): string[] {
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

export type ParsedRoyalMailRate = Omit<RoyalMailRateRow, "id" | "sortOrder">;

/** Parses an uploaded CSV into rate rows, skipping (and reporting) any line
 * that doesn't have a usable weight or price rather than failing the whole
 * import over one bad row. Column order matches ROYAL_MAIL_RATES_CSV_HEADER
 * but is actually read by column NAME from the header row, so a re-ordered
 * or partially-extended export still works. */
export function parseRoyalMailRatesCsv(text: string): { rows: ParsedRoyalMailRate[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: string[] = [];
  if (lines.length === 0) return { rows: [], errors: ["The file is empty."] };

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idx = {
    country: col("country_code"),
    service: col("service"),
    weight: col("max_weight_g"),
    length: col("max_length_cm"),
    width: col("max_width_cm"),
    height: col("max_height_cm"),
    price: col("price_gbp"),
  };
  if (idx.weight === -1 || idx.price === -1) {
    return { rows: [], errors: [`The file needs at least "max_weight_g" and "price_gbp" columns — found: ${header.join(", ")}`] };
  }

  const rows: ParsedRoyalMailRate[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]);
    const lineNo = i + 1;
    const weight = Math.round(Number(fields[idx.weight]));
    const price = Number(fields[idx.price]);
    if (!Number.isFinite(weight) || weight <= 0) {
      errors.push(`Line ${lineNo}: missing or invalid max_weight_g — skipped.`);
      continue;
    }
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`Line ${lineNo}: missing or invalid price_gbp — skipped.`);
      continue;
    }
    const countryRaw = idx.country >= 0 ? fields[idx.country]?.trim().toUpperCase() : "";
    const num = (i: number) => {
      if (i < 0) return null;
      const v = Number(fields[i]);
      return fields[i]?.trim() && Number.isFinite(v) ? v : null;
    };
    rows.push({
      countryCode: countryRaw && countryRaw !== "ANY" ? countryRaw : null,
      service: (idx.service >= 0 ? fields[idx.service]?.trim() : "") || "Royal Mail",
      maxWeightGrams: weight,
      maxLengthCm: num(idx.length),
      maxWidthCm: num(idx.width),
      maxHeightCm: num(idx.height),
      priceMinor: Math.round(price * 100),
    });
  }

  return { rows, errors };
}
