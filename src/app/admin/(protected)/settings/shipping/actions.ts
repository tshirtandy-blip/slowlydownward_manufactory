"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SHIPPING_ZONE_KEYS, type ShippingZoneKey } from "@/lib/shipping";
import { COUNTRIES } from "@/lib/countries";
import { parseRoyalMailRatesCsv, type ParsedRoyalMailRate } from "@/lib/royal-mail-rates";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

function parsePriceMinor(raw: FormDataEntryValue | null): number {
  const pounds = Number(raw);
  if (!Number.isFinite(pounds) || pounds < 0) return 0;
  return Math.round(pounds * 100);
}

export async function updateShippingZones(formData: FormData) {
  await requireAdmin();

  // One <select name="country_XX"> per country, valued "UK" | "EUROPE" |
  // "ROW" | "" (not shipped) — rebuild each zone's country list from
  // scratch out of these, so a country can only ever belong to one zone.
  const countryCodes: Record<ShippingZoneKey, string[]> = { UK: [], EUROPE: [], ROW: [] };
  for (const { code } of COUNTRIES) {
    const assigned = String(formData.get(`country_${code}`) || "");
    if (SHIPPING_ZONE_KEYS.includes(assigned as ShippingZoneKey)) {
      countryCodes[assigned as ShippingZoneKey].push(code);
    }
  }

  await prisma.$transaction(
    SHIPPING_ZONE_KEYS.map((key) =>
      prisma.shippingZone.upsert({
        where: { key },
        update: {
          label: String(formData.get(`label_${key}`) || key).trim() || key,
          priceMinor: parsePriceMinor(formData.get(`price_${key}`)),
          countryCodes: countryCodes[key],
        },
        create: {
          key,
          label: String(formData.get(`label_${key}`) || key).trim() || key,
          priceMinor: parsePriceMinor(formData.get(`price_${key}`)),
          countryCodes: countryCodes[key],
          sortOrder: SHIPPING_ZONE_KEYS.indexOf(key),
        },
      })
    )
  );

  revalidatePath("/admin/settings/shipping");
  revalidatePath("/cart");
}

/** Replaces every RoyalMailRate row with a fresh set, in one transaction —
 * shared by both the manual editor and the CSV import below, so there's
 * only one place that decides how a save actually lands in the database. */
async function replaceRoyalMailRates(rows: ParsedRoyalMailRate[]) {
  const sorted = [...rows].sort((a, b) => (a.countryCode ?? "").localeCompare(b.countryCode ?? "") || a.maxWeightGrams - b.maxWeightGrams);
  await prisma.$transaction([
    prisma.royalMailRate.deleteMany({}),
    ...sorted.map((r, i) => prisma.royalMailRate.create({ data: { ...r, sortOrder: i } })),
  ]);
  revalidatePath("/admin/settings/shipping");
  revalidatePath("/admin/pack");
}

/** Fully replaces the Royal Mail price list from the manual editor's rows —
 * this list is entirely admin-managed, so a clean replace each save is
 * simpler and safer than trying to diff/match existing rows by id. */
export async function updateRoyalMailRates(formData: FormData) {
  await requireAdmin();

  let rows: { countryCode?: string; service?: string; maxWeightGrams?: string; maxLengthCm?: string; maxWidthCm?: string; maxHeightCm?: string; price?: string }[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("rates") || "[]"));
    if (Array.isArray(parsed)) rows = parsed;
  } catch {
    // Malformed JSON from a tampered request — save an empty list rather
    // than fail the whole page.
  }

  const optionalNumber = (raw: string | undefined) => {
    const n = Number(raw);
    return raw && Number.isFinite(n) ? n : null;
  };

  const clean: ParsedRoyalMailRate[] = rows
    .map((r) => ({
      countryCode: r.countryCode ? r.countryCode.trim().toUpperCase() : null,
      service: String(r.service || "").trim(),
      maxWeightGrams: Math.round(Number(r.maxWeightGrams)),
      maxLengthCm: optionalNumber(r.maxLengthCm),
      maxWidthCm: optionalNumber(r.maxWidthCm),
      maxHeightCm: optionalNumber(r.maxHeightCm),
      priceMinor: parsePriceMinor(r.price ?? ""),
    }))
    .filter((r) => r.service && Number.isFinite(r.maxWeightGrams) && r.maxWeightGrams > 0);

  await replaceRoyalMailRates(clean);
}

/** Bulk-imports the Royal Mail price list from an uploaded CSV, replacing
 * whatever was there before — for a real price sheet (which can run to
 * hundreds of rows across countries/weights/formats) this is far more
 * practical than typing every row in by hand. The file is read to plain
 * text on the client and passed here as a string (see
 * RoyalMailRatesCsvImport.tsx) rather than handled as a multipart upload,
 * since a price list is always small, plain text. */
export async function importRoyalMailRatesCsv(
  csvText: string
): Promise<{ ok: true; imported: number; errors: string[] } | { ok: false; error: string }> {
  await requireAdmin();

  const { rows, errors } = parseRoyalMailRatesCsv(csvText);
  if (rows.length === 0) {
    return { ok: false, error: errors[0] ?? "No valid rows found in that file." };
  }

  await replaceRoyalMailRates(rows);
  return { ok: true, imported: rows.length, errors };
}
