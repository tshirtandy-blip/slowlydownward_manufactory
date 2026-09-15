import { prisma } from "@/lib/prisma";
import { splitCsvLine, yesNoCell, stringCell } from "@/lib/csv";

/**
 * Bulk-import for the print catalogue (Admin > Settings > Import) — built
 * with migrating the old Shopify catalogue in mind, but just as usable for
 * any future batch of new products. Matches each row to an existing print
 * by slug (falling back to one generated from the title) so re-uploading a
 * corrected file updates rather than duplicates. Images aren't part of
 * this: leave image_url blank and add photos afterwards from each
 * product's own edit page — see "Image uploads" in the README.
 */

export const PRODUCTS_CSV_HEADER =
  "title,slug,artist,description,technique,paper_size,image_size,medium,year,edition_size,price_gbp,image_url,published";

export function productsCsvTemplate(): string {
  return [
    PRODUCTS_CSV_HEADER,
    'Winter Study,,Stanley Donwood,A screenprint made in the depths of winter.,"Screenprint, 4 colours",A2 (420 x 594mm),300 x 400mm,Screenprint,2019,200,145.00,,yes',
    "Open Edition Mug,,Stanley Donwood,,,,,,,open,18.00,,yes",
  ].join("\n");
}

export type ParsedProductRow = {
  title: string;
  slug: string | null;
  artist: string | null;
  description: string | null;
  technique: string | null;
  paperSize: string | null;
  imageSize: string | null;
  medium: string | null;
  year: number | null;
  editionSize: number | null; // null = open edition
  priceMinor: number;
  imageUrl: string | null;
  published: boolean;
};

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function parseProductsCsv(text: string): { rows: ParsedProductRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: string[] = [];
  if (lines.length === 0) return { rows: [], errors: ["The file is empty."] };

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idx = {
    title: col("title"),
    slug: col("slug"),
    artist: col("artist"),
    description: col("description"),
    technique: col("technique"),
    paperSize: col("paper_size"),
    imageSize: col("image_size"),
    medium: col("medium"),
    year: col("year"),
    editionSize: col("edition_size"),
    price: col("price_gbp"),
    imageUrl: col("image_url"),
    published: col("published"),
  };
  if (idx.title === -1 || idx.price === -1) {
    return { rows: [], errors: [`The file needs at least "title" and "price_gbp" columns — found: ${header.join(", ")}`] };
  }

  const rows: ParsedProductRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]);
    const lineNo = i + 1;
    const title = fields[idx.title]?.trim();
    if (!title) {
      errors.push(`Line ${lineNo}: missing title — skipped.`);
      continue;
    }
    const price = Number(fields[idx.price]);
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`Line ${lineNo}: missing or invalid price_gbp — skipped.`);
      continue;
    }
    const editionRaw = idx.editionSize >= 0 ? fields[idx.editionSize]?.trim().toLowerCase() : "";
    let editionSize: number | null = null;
    if (editionRaw && editionRaw !== "open") {
      const n = Math.round(Number(editionRaw));
      if (!Number.isFinite(n) || n <= 0) {
        errors.push(`Line ${lineNo}: edition_size "${editionRaw}" isn't a number or "open" — treated as open edition.`);
      } else {
        editionSize = n;
      }
    }
    const yearRaw = stringCell(fields, idx.year);

    rows.push({
      title,
      slug: stringCell(fields, idx.slug),
      artist: stringCell(fields, idx.artist),
      description: stringCell(fields, idx.description),
      technique: stringCell(fields, idx.technique),
      paperSize: stringCell(fields, idx.paperSize),
      imageSize: stringCell(fields, idx.imageSize),
      medium: stringCell(fields, idx.medium),
      year: yearRaw ? Math.round(Number(yearRaw)) || null : null,
      editionSize,
      priceMinor: Math.round(price * 100),
      imageUrl: stringCell(fields, idx.imageUrl),
      published: yesNoCell(fields, idx.published),
    });
  }
  return { rows, errors };
}

/** Creates or updates a Print per row, matched by slug (the row's own slug
 * column if given, else one generated from the title). A numeric
 * edition_size creates the matching numbered Edition rows, but only the
 * first time a print is created by this importer — an existing print's
 * edition rows are left alone on a re-upload, since real stock/sales may
 * already be recorded against them (use the product's own Stock page to
 * change edition count after the fact, same as any manually-created
 * print). */
export async function applyProductsImport(
  rows: ParsedProductRow[]
): Promise<{ created: number; updated: number; errors: string[] }> {
  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  const usedSlugs = new Set<string>();

  for (const row of rows) {
    try {
      const baseSlug = row.slug ? slugifyTitle(row.slug) : slugifyTitle(row.title);
      const slug = baseSlug || `print-${Date.now()}-${created + updated}`;

      const existing = await prisma.print.findUnique({ where: { slug } });
      if (existing) {
        await prisma.print.update({
          where: { slug },
          data: {
            title: row.title,
            artist: row.artist ?? undefined,
            description: row.description ?? undefined,
            technique: row.technique ?? undefined,
            paperSize: row.paperSize ?? undefined,
            imageSize: row.imageSize ?? undefined,
            medium: row.medium ?? undefined,
            year: row.year ?? undefined,
            priceMinor: row.priceMinor,
            primaryImageUrl: row.imageUrl ?? undefined,
            published: row.published,
          },
        });
        updated++;
      } else {
        // Guards against two new rows in the same file slugifying to the
        // same value (e.g. two prints both just called "Untitled") —
        // appends a numeric suffix rather than letting the second fail.
        let finalSlug = slug;
        let n = 2;
        while (usedSlugs.has(finalSlug) || (await prisma.print.findUnique({ where: { slug: finalSlug } }))) {
          finalSlug = `${slug}-${n++}`;
        }
        usedSlugs.add(finalSlug);

        await prisma.print.create({
          data: {
            title: row.title,
            slug: finalSlug,
            artist: row.artist || undefined,
            description: row.description || undefined,
            technique: row.technique || undefined,
            paperSize: row.paperSize || undefined,
            imageSize: row.imageSize || undefined,
            medium: row.medium || undefined,
            year: row.year || undefined,
            editionSize: row.editionSize,
            priceMinor: row.priceMinor,
            primaryImageUrl: row.imageUrl || undefined,
            published: row.published,
            editions: row.editionSize
              ? { create: Array.from({ length: row.editionSize }).map((_, i) => ({ number: i + 1 })) }
              : undefined,
          },
        });
        created++;
      }
    } catch (err: any) {
      errors.push(`${row.title}: ${err?.message || "Couldn't save this row."}`);
    }
  }
  return { created, updated, errors };
}
