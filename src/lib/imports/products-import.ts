import { prisma } from "@/lib/prisma";
import { splitCsvLine, yesNoCell, stringCell } from "@/lib/csv";
import { uploadImage } from "@/lib/supabase-admin";

/**
 * Bulk-import for the print catalogue (Admin > Settings > Import) — built
 * with migrating the old Shopify catalogue in mind, but just as usable for
 * any future batch of new products. Matches each row to an existing print
 * by slug (falling back to one generated from the title) so re-uploading a
 * corrected file updates rather than duplicates.
 *
 * A row's image_url is downloaded and re-uploaded into this store's own
 * Supabase Storage (the same bucket the admin drag-and-drop picker uses) —
 * see fetchAndHostImage below — rather than just linking to wherever the
 * spreadsheet points, so the photo doesn't depend on some other site
 * staying up or allowing hotlinking. A handful of images are fetched at
 * once (see mapWithConcurrency) rather than all 200+ at the same time.
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

const IMAGE_FETCH_TIMEOUT_MS = 15_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // matches the limit in /api/admin/upload
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const IMAGE_FETCH_CONCURRENCY = 4;

function extensionForContentType(type: string): string {
  switch (type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

function filenameFromUrl(url: string, contentType: string): string {
  try {
    const path = new URL(url).pathname;
    const base = path.split("/").filter(Boolean).pop();
    if (base && /\.[a-z0-9]+$/i.test(base)) return base;
  } catch {
    // Not a parseable URL (shouldn't happen, already validated) — fall
    // through to a generic name below.
  }
  return `product.${extensionForContentType(contentType)}`;
}

/** Downloads an image from an external URL (a row's image_url column) and
 * re-uploads it into Supabase Storage, returning the new permanent hosted
 * URL — or an error message rather than throwing, so one bad link doesn't
 * stop the rest of the import. Same size/type rules as the admin's own
 * drag-and-drop picker (src/app/api/admin/upload/route.ts). */
async function fetchAndHostImage(sourceUrl: string): Promise<{ url: string } | { error: string }> {
  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
    try {
      response = await fetch(sourceUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return { error: `couldn't reach ${sourceUrl} (timed out or unreachable)` };
  }
  if (!response.ok) {
    return { error: `${sourceUrl} returned an error (HTTP ${response.status})` };
  }
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return { error: `${sourceUrl} isn't a JPEG, PNG, WebP, or GIF image (got "${contentType || "unknown"}")` };
  }

  let buffer: Buffer;
  try {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return { error: `${sourceUrl} is larger than 8MB` };
    }
    buffer = Buffer.from(arrayBuffer);
  } catch {
    return { error: `couldn't download ${sourceUrl}` };
  }

  try {
    const hostedUrl = await uploadImage(buffer, filenameFromUrl(sourceUrl, contentType), contentType);
    return { url: hostedUrl };
  } catch (err: any) {
    return { error: err?.message || `couldn't upload the image from ${sourceUrl}` };
  }
}

/** Runs async work with at most `limit` items in flight at once — used so
 * importing 200+ products doesn't try to fetch 200+ images all at the same
 * moment. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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

  // Resolve every distinct image_url up front, a handful at a time, so the
  // same photo referenced by more than one row is only downloaded once,
  // and so a broken link is known before touching the database at all. A
  // row whose image couldn't be fetched still gets created/updated below —
  // just without a photo, and with the reason reported alongside any other
  // row errors — rather than failing that row (or the whole file) outright.
  const uniqueImageUrls = Array.from(new Set(rows.map((r) => r.imageUrl).filter((u): u is string => !!u)));
  const hostedByUrl = new Map<string, string>();
  if (uniqueImageUrls.length > 0) {
    const resolved = await mapWithConcurrency(uniqueImageUrls, IMAGE_FETCH_CONCURRENCY, async (url) => ({
      url,
      result: await fetchAndHostImage(url),
    }));
    for (const { url, result } of resolved) {
      if ("url" in result) {
        hostedByUrl.set(url, result.url);
      } else {
        errors.push(`Image ${url}: ${result.error} — the product(s) using it were saved without a photo.`);
      }
    }
  }

  for (const row of rows) {
    try {
      const baseSlug = row.slug ? slugifyTitle(row.slug) : slugifyTitle(row.title);
      const slug = baseSlug || `print-${Date.now()}-${created + updated}`;
      const hostedImageUrl = row.imageUrl ? hostedByUrl.get(row.imageUrl) : undefined;

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
            // Only overwrites the existing photo when this row's image
            // actually resolved — a blank column or a failed fetch leaves
            // whatever photo is already there alone, rather than blanking it.
            primaryImageUrl: hostedImageUrl ?? undefined,
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
            primaryImageUrl: hostedImageUrl || undefined,
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
