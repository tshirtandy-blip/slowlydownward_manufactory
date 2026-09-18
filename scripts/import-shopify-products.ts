/**
 * One-off backfill: imports the full Shopify product catalog into the
 * `Print` table (the new build's product model) from a static export —
 * scripts/data/shopify-products/chunk-*.json — rather than calling the
 * Shopify API directly. That export was pulled once, by hand, via Claude's
 * live Shopify connector session and committed alongside this script, so
 * running this needs no Shopify credentials at all, just your database.
 * Split across several small chunk files purely so each one could be
 * transferred and verified individually when this was first committed —
 * they're read together as one catalog below, in filename order.
 *
 * Scope: imports all 322 products regardless of Shopify status (Active,
 * Draft, Archived) — see README > Product catalog (Shopify import) for why.
 * Every imported Print is created with `published: false` regardless of its
 * Shopify status, since many fields are known to be missing or mismatched
 * (see below) — nothing appears on the storefront until you review and
 * publish it from Admin > Products yourself.
 *
 * Field mapping:
 *   - slug            <- Shopify's handle (already unique per store)
 *   - title, images    <- taken as-is; confirmed accurate by you
 *   - description      <- Shopify's descriptionHtml, sanitizeRichText()'d;
 *                         confirmed accurate by you
 *   - priceMinor       <- Shopify's variant price; confirmed accurate by you
 *   - editionSize, paperSize, imageSize, medium, technique, year
 *                       <- parsed out of the description text with the
 *                         regexes below (parseSpecs/parseMedium). You said
 *                         these are usually embedded in the description
 *                         rather than in Shopify's own structured fields,
 *                         which is what makes this a best-effort parse
 *                         rather than a reliable one — every one of these
 *                         is left null when nothing matches, and should be
 *                         spot-checked, not trusted blindly.
 *
 * Deliberately NOT set: editionSize alone is populated, but no individual
 * Edition (numbered-copy) rows are created — Shopify only ever gave us
 * current remaining stock, never which specific numbers were sold, so
 * fabricating Edition rows from that would just be guessing. Stock/edition
 * numbering for each print is something to set up by hand once you're
 * ready to actually sell it (Admin > Products > a print > Stock).
 *
 * Safe to re-run: every product upserts by slug (the Shopify handle), so a
 * second pass just re-applies the same parse to rows it already imported
 * rather than duplicating them. Re-running after a hand edit in Admin will
 * overwrite that edit's fields with the freshly re-parsed values — this is
 * meant to be run once, not on a schedule.
 *
 * Run it once, by hand, against your real database:
 *
 *   DATABASE_URL="<Supabase DIRECT connection string>" \
 *   DIRECT_URL="<same>" \
 *   npm run import:shopify-products
 *
 * (Use the *direct*, non-pooled Supabase connection string, same as
 * `npx prisma migrate deploy` in the README.)
 */
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import sanitizeHtml from "sanitize-html";

const prisma = new PrismaClient();

// Mirrors sanitizeRichText() in src/lib/sanitize.ts — duplicated here rather
// than imported since this script runs standalone via tsx, outside the
// Next.js module graph.
function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["b", "strong", "i", "em", "u", "p", "div", "br", "ul", "ol", "li", "a"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
    },
  }).trim();
}

type ShopifyProductExport = {
  shopifyId: string;
  title: string;
  handle: string;
  status: string;
  descriptionHtml: string;
  price: string | null;
  currency: string;
  images: string[];
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// e.g. "580mm x 640mm", "60cm x 62cm", "Approx. 640mm x 480mm" — first
// number's own unit is optional (often omitted before the "x"), second
// number's unit is required and wins if they differ (never seen in
// practice, but favours the more specific one just in case).
const DIMENSION_PATTERN = "(\\d{2,4})\\s*(mm|cm)?\\s*[x×]\\s*(\\d{2,4})\\s*(mm|cm)";

function extractDimensions(text: string, label: string): string | null {
  const re = new RegExp(`${label}\\W{0,8}?${DIMENSION_PATTERN}`, "i");
  const m = re.exec(text);
  if (!m) return null;
  const [, w, wUnit, h, hUnit] = m;
  const unit = hUnit || wUnit || "mm";
  return `${w} x ${h}${unit}`;
}

function extractEditionSize(text: string): number | null {
  if (/open\s*edition/i.test(text)) return null; // explicit open edition
  // Deliberately requires "of" or ":" between "edition" and the number —
  // without it, a bare "edition NUMBER" false-positives on phrasing like
  // "2024 edition" followed a few words later, after HTML-stripping
  // collapses the paragraph break, by an unrelated number (e.g. a colour
  // count: "...2024 edition / 11 colour hand-pulled screenprint..." reads
  // as "edition 11" once flattened to plain text). Verified against the
  // real export data before adding this constraint — every genuine
  // "edition of N" / "edition: N" mention in this catalog includes one of
  // the two, and the only two bare "edition NUMBER" matches without them
  // were both this exact false positive.
  const m = /edition\s*(?:of|:)\s*(\d{1,4})/i.exec(text);
  return m ? parseInt(m[1], 10) : null;
}

function extractYear(text: string): number | null {
  const m = /year\s*:?\s*(19\d{2}|20\d{2})/i.exec(text);
  return m ? parseInt(m[1], 10) : null;
}

// Best-effort only — a short display tag, not authoritative. Order matters:
// checked most-specific-first so "hand-pulled screenprint" doesn't fall
// through to a generic match.
const MEDIUM_KEYWORDS: Array<[RegExp, string]> = [
  [/screen ?print/i, "Screenprint"],
  [/linocut/i, "Linocut"],
  [/letterpress/i, "Letterpress"],
  [/lithograph/i, "Lithograph"],
  [/gicl(e|é)e/i, "Giclée"],
  [/etching/i, "Etching"],
  [/woodcut/i, "Woodcut"],
];

function extractMedium(text: string): string | null {
  for (const [re, label] of MEDIUM_KEYWORDS) {
    if (re.test(text)) return label;
  }
  return null;
}

function extractTechnique(text: string, medium: string | null): string | null {
  if (!medium) return null;
  const m = /(\d{1,2})\s*colou?rs?/i.exec(text);
  return m ? `${medium}, ${m[1]} colours` : medium;
}

function loadProducts(): ShopifyProductExport[] {
  const dir = path.join(__dirname, "data", "shopify-products");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const products: ShopifyProductExport[] = [];
  for (const file of files) {
    const chunk: ShopifyProductExport[] = JSON.parse(readFileSync(path.join(dir, file), "utf-8"));
    products.push(...chunk);
  }
  return products;
}

async function main() {
  const products = loadProducts();
  console.log(`Loaded ${products.length} product(s) from scripts/data/shopify-products/`);

  let created = 0;
  let updated = 0;
  let errors = 0;
  const parsedNone: string[] = [];

  for (const p of products) {
    try {
      const plainText = stripHtml(p.descriptionHtml);
      const editionSize = extractEditionSize(plainText);
      const paperSize = extractDimensions(plainText, "paper\\s*size");
      const imageSize = extractDimensions(plainText, "(?:print|image)\\s*size");
      const year = extractYear(plainText);
      const medium = extractMedium(plainText);
      const technique = extractTechnique(plainText, medium);

      if (editionSize === null && !paperSize && !imageSize) {
        parsedNone.push(p.title);
      }

      const priceFloat = p.price ? parseFloat(p.price) : 0;
      const priceMinor = Math.round(priceFloat * 100);

      const data = {
        title: p.title,
        description: p.descriptionHtml ? sanitizeRichText(p.descriptionHtml) : null,
        priceMinor,
        currency: p.currency || "GBP",
        primaryImageUrl: p.images[0] ?? null,
        imageUrls: p.images.length > 1 ? p.images.slice(1) : undefined,
        paperSize: paperSize ?? undefined,
        imageSize: imageSize ?? undefined,
        medium: medium ?? undefined,
        technique: technique ?? undefined,
        year: year ?? undefined,
        editionSize: editionSize ?? undefined,
        published: false, // always — see header comment
      };

      const existing = await prisma.print.findUnique({ where: { slug: p.handle } });
      if (existing) {
        await prisma.print.update({ where: { slug: p.handle }, data });
        updated++;
      } else {
        await prisma.print.create({ data: { ...data, slug: p.handle } });
        created++;
      }
    } catch (err) {
      console.warn(`- ${p.title} (${p.handle}): failed —`, err instanceof Error ? err.message : err);
      errors++;
    }
  }

  console.log(`\nDone — ${created} created, ${updated} updated, ${errors} error(s).`);
  console.log(
    `${parsedNone.length} product(s) had no edition size, paper size, or print size parsed from their ` +
      `description — these will need those fields filled in by hand:`
  );
  for (const title of parsedNone) console.log(`  - ${title}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
