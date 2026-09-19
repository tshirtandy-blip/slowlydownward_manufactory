/**
 * One-off backfill: imports historical orders from the old Shopify store
 * into this app's own Order/OrderItem/Customer tables, so returning
 * customers see their real purchase history at /account/orders.
 *
 * Unlike scripts/import-shopify-products.ts, the input here is NOT
 * committed to the repo — order data contains customer names, emails,
 * phone numbers and shipping addresses, and that must never end up in
 * git. Instead you were handed a single JSON file (a plain array of
 * Shopify Order nodes, fetched read-only via the Shopify Admin GraphQL
 * API) as a direct download. Keep it wherever you like on your own
 * machine — just don't add it to this repo — and pass its path as the
 * one required argument below.
 *
 * Run it by hand, against your real database:
 *
 *   DATABASE_URL="<Supabase DIRECT connection string>" \
 *   DIRECT_URL="<same>" \
 *   npm run import:shopify-orders -- /path/to/shopify-orders.json
 *
 * Useful flags while checking the mapping before committing to the full
 * run (put them after another `--`, same as the file path):
 *
 *   --limit=50     only process the first 50 orders in the file
 *   --dry-run      log what each order would do, write nothing to the DB
 *
 * e.g. DATABASE_URL=... DIRECT_URL=... npm run import:shopify-orders -- \
 *        /path/to/shopify-orders.json --limit=50 --dry-run
 *
 * What this does, per order:
 *   1. Dedupe — orderNumber is "SHOP-" + Shopify's own order number (e.g.
 *      "#SD1008" -> "SHOP-1008"), a prefix that can never collide with
 *      this app's own SD26-XXXX numbers (see generateOrderNumber in
 *      src/lib/money.ts). If an order with that orderNumber already
 *      exists, it's skipped — exactly the same de-dupe check the live CSV
 *      importer (src/lib/imports/orders-import.ts) already uses, so this
 *      script is safe to re-run: a second pass (e.g. to pick up orders
 *      placed after the first export) just skips everything it already
 *      imported.
 *   2. Skips orders that were never a real completed sale — Shopify's
 *      displayFinancialStatus is VOIDED or PENDING *and* the order was
 *      never fulfilled. (Checked against this store's actual data: the
 *      overwhelming majority of orders show AUTHORIZED rather than PAID
 *      even though they were fulfilled and shipped — that's just how this
 *      store's payment gateway reported back to Shopify, not a sign the
 *      sale didn't happen, so AUTHORIZED+FULFILLED orders ARE imported.)
 *   3. Customer — upserts by email, filling in firstName/lastName/phone
 *      only where the customer record doesn't already have them, so a
 *      real account (e.g. from a later signup) is never overwritten with
 *      older Shopify data.
 *   4. Print resolution — matches each line item to an existing Print by
 *      Shopify's product handle (same slug key scripts/import-shopify-
 *      products.ts uses), falling back to a case-insensitive title match.
 *      A line item that matches nothing gets a minimal placeholder Print
 *      created on the spot (published: false, so it never appears on the
 *      storefront) — fix these up afterwards from Admin > Orders > (an
 *      order) > Edit next to the item, which re-points it at the correct
 *      Print. Resolved/created prints are cached for the whole run so the
 *      same unmatched product isn't created twice.
 *   5. Status — FULFILLED maps to SHIPPED; REFUNDED/PARTIALLY_REFUNDED
 *      maps to REFUNDED (regardless of fulfillment — a refund is the more
 *      important fact to show); PAID-but-not-yet-fulfilled maps to PAID;
 *      anything else falls back to SHIPPED (a safe default for old,
 *      presumably-completed history).
 *   6. Order + items — one prisma transaction per order (source: MANUAL,
 *      the same "not from our storefront" bucket the CSV importer already
 *      uses for this kind of historical record — no schema change here).
 *      No edition numbers are set on any imported line — there's no
 *      historical per-copy data from Shopify, and the order pages already
 *      render an item with no edition cleanly.
 *
 * One order failing doesn't stop the run — every order gets its own
 * try/catch, and a summary of created / already-imported / not-a-real-
 * sale / no-email / errors prints at the end.
 */
import { readFileSync } from "fs";
import { PrismaClient, OrderStatus } from "@prisma/client";
import { slugify } from "../src/lib/slugify";

const prisma = new PrismaClient();

type ShopifyMoney = { shopMoney: { amount: string; currencyCode: string } };

type ShopifyLineItem = {
  title: string;
  quantity: number;
  originalUnitPriceSet: ShopifyMoney;
  product: { handle: string } | null;
};

type ShopifyOrderNode = {
  id: string;
  name: string;
  createdAt: string;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  currencyCode: string;
  email: string | null;
  phone: string | null;
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    defaultEmailAddress: { emailAddress: string } | null;
    defaultPhoneNumber: { phoneNumber: string } | null;
  } | null;
  shippingAddress: {
    address1: string | null;
    address2: string | null;
    city: string | null;
    zip: string | null;
    country: string | null;
    countryCodeV2: string | null;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    phone: string | null;
  } | null;
  currentTotalPriceSet: ShopifyMoney;
  totalShippingPriceSet: ShopifyMoney;
  lineItems: { edges: { node: ShopifyLineItem }[] };
};

function toMinor(amount: string): number {
  return Math.round(parseFloat(amount) * 100);
}

function mapStatus(financial: string, fulfillment: string): OrderStatus {
  if (financial === "REFUNDED" || financial === "PARTIALLY_REFUNDED") return "REFUNDED";
  if (fulfillment === "FULFILLED") return "SHIPPED";
  if (financial === "PAID") return "PAID";
  return "SHIPPED"; // safe default — this store's history is ~99% fulfilled
}

/** Not a real completed sale worth showing a customer — an abandoned or
 * voided checkout that never shipped. Everything else (including the
 * AUTHORIZED-but-fulfilled majority of this store's history) is kept. */
function isCompletedSale(financial: string, fulfillment: string): boolean {
  if (fulfillment === "FULFILLED") return true;
  if ((financial === "VOIDED" || financial === "PENDING") && fulfillment !== "FULFILLED") return false;
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;

  if (!filePath) {
    console.error(
      "Usage: npm run import:shopify-orders -- /path/to/shopify-orders.json [--limit=N] [--dry-run]"
    );
    process.exitCode = 1;
    return;
  }

  const raw = readFileSync(filePath, "utf8");
  const orders: ShopifyOrderNode[] = JSON.parse(raw);
  const toProcess = limit ? orders.slice(0, limit) : orders;

  console.log(
    `Loaded ${orders.length} order(s) from ${filePath}${
      limit ? ` — processing first ${toProcess.length} (--limit)` : ""
    }${dryRun ? " — DRY RUN, nothing will be written" : ""}\n`
  );

  let created = 0;
  let skippedDuplicate = 0;
  let skippedNotCompletedSale = 0;
  let skippedNoEmail = 0;
  let skippedNoItems = 0;
  let placeholdersCreated = 0;
  const errors: string[] = [];

  // Cached across the whole run so the same unmatched Shopify product
  // handle/title only ever creates one placeholder Print, however many
  // orders reference it.
  const printCache = new Map<string, string>();

  async function resolvePrintId(li: ShopifyLineItem): Promise<string> {
    const handle = li.product?.handle || null;
    const cacheKey = handle || `title:${li.title.toLowerCase().trim()}`;
    const cached = printCache.get(cacheKey);
    if (cached) return cached;

    let print = handle ? await prisma.print.findUnique({ where: { slug: handle } }) : null;
    if (!print) {
      print = await prisma.print.findFirst({ where: { title: { equals: li.title, mode: "insensitive" } } });
    }

    if (!print) {
      let baseSlug = handle || slugify(li.title) || "imported-item";
      let finalSlug = baseSlug;
      let n = 1;
      // Guard against colliding with a real Print that happens to share a
      // slug we're about to invent (title-derived slugs especially).
      while (await prisma.print.findUnique({ where: { slug: finalSlug } })) {
        finalSlug = `${baseSlug}-${++n}`;
      }
      const unitPriceMinor = toMinor(li.originalUnitPriceSet.shopMoney.amount);
      if (!dryRun) {
        print = await prisma.print.create({
          data: {
            slug: finalSlug,
            title: li.title,
            priceMinor: unitPriceMinor,
            currency: li.originalUnitPriceSet.shopMoney.currencyCode || "GBP",
            published: false,
          },
        });
      } else {
        print = { id: `dry-run-placeholder:${finalSlug}` } as any;
      }
      placeholdersCreated++;
    }

    printCache.set(cacheKey, print.id);
    return print.id;
  }

  for (const node of toProcess) {
    const orderNumber = `SHOP-${node.name.replace(/^#/, "")}`;
    try {
      if (!isCompletedSale(node.displayFinancialStatus, node.displayFulfillmentStatus)) {
        skippedNotCompletedSale++;
        continue;
      }

      const existing = await prisma.order.findUnique({ where: { orderNumber } });
      if (existing) {
        skippedDuplicate++;
        continue;
      }

      const email = node.customer?.defaultEmailAddress?.emailAddress || node.email;
      if (!email) {
        skippedNoEmail++;
        errors.push(`${orderNumber}: no email on the order or the customer — skipped.`);
        continue;
      }

      const itemsData: { printId: string; unitPriceMinor: number; requestedEditionNumber: null }[] = [];
      for (const edge of node.lineItems.edges) {
        const li = edge.node;
        const printId = await resolvePrintId(li);
        const unitPriceMinor = toMinor(li.originalUnitPriceSet.shopMoney.amount);
        for (let i = 0; i < Math.max(1, li.quantity); i++) {
          itemsData.push({ printId, unitPriceMinor, requestedEditionNumber: null });
        }
      }
      if (itemsData.length === 0) {
        skippedNoItems++;
        errors.push(`${orderNumber}: no line items — skipped.`);
        continue;
      }

      const totalMinor = toMinor(node.currentTotalPriceSet.shopMoney.amount);
      const shippingMinor = toMinor(node.totalShippingPriceSet.shopMoney.amount);
      const subtotalMinor = totalMinor - shippingMinor;

      const addr = node.shippingAddress;
      const shippingAddress = addr
        ? {
            line1: addr.address1 ?? "",
            line2: addr.address2 ?? "",
            city: addr.city ?? "",
            postal_code: addr.zip ?? "",
            country: addr.countryCodeV2 ?? "",
          }
        : undefined;
      const shippingName =
        addr?.name ||
        [addr?.firstName, addr?.lastName].filter(Boolean).join(" ") ||
        [node.customer?.firstName, node.customer?.lastName].filter(Boolean).join(" ") ||
        undefined;

      const status = mapStatus(node.displayFinancialStatus, node.displayFulfillmentStatus);
      const shopFirstName = node.customer?.firstName ?? null;
      const shopLastName = node.customer?.lastName ?? null;
      const shopPhone = node.customer?.defaultPhoneNumber?.phoneNumber || node.phone || null;

      if (dryRun) {
        created++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const existingCustomer = await tx.customer.findUnique({ where: { email } });
        const customer = existingCustomer
          ? await tx.customer.update({
              where: { email },
              data: {
                firstName: existingCustomer.firstName ?? shopFirstName ?? undefined,
                lastName: existingCustomer.lastName ?? shopLastName ?? undefined,
                phone: existingCustomer.phone ?? shopPhone ?? undefined,
              },
            })
          : await tx.customer.create({
              data: {
                email,
                firstName: shopFirstName ?? undefined,
                lastName: shopLastName ?? undefined,
                phone: shopPhone ?? undefined,
              },
            });

        await tx.order.create({
          data: {
            orderNumber,
            customerId: customer.id,
            status,
            source: "MANUAL",
            subtotalMinor,
            shippingMinor,
            totalMinor,
            currency: node.currencyCode || "GBP",
            shippingName,
            shippingAddress,
            shippingCountry: addr?.countryCodeV2 ?? undefined,
            createdAt: new Date(node.createdAt),
            items: { create: itemsData },
          },
        });
      });

      created++;
    } catch (err) {
      errors.push(`${orderNumber}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  console.log(`\nDone${dryRun ? " (dry run — nothing written)" : ""}.`);
  console.log(`  Created:                    ${created}`);
  console.log(`  Already imported (skipped): ${skippedDuplicate}`);
  console.log(`  Not a completed sale:       ${skippedNotCompletedSale}`);
  console.log(`  No email (skipped):         ${skippedNoEmail}`);
  console.log(`  No line items (skipped):    ${skippedNoItems}`);
  console.log(`  Placeholder prints created: ${placeholdersCreated}`);
  if (errors.length) {
    console.log(`\n${errors.length} error/warning message(s):`);
    for (const e of errors) console.log(`  - ${e}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
