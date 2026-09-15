import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { splitCsvLine, stringCell, parseCsvDate } from "@/lib/csv";
import { generateOrderNumber } from "@/lib/money";

/**
 * Bulk-import for historical/archival purchases (Admin > Settings >
 * Import) — for records of sales that happened before this system existed
 * (an old spreadsheet, Shopify order history, etc.), not for taking new
 * orders. Each row is one line item; rows that share the same order_number
 * are grouped into a single multi-item order, and a blank order_number
 * makes that row its own one-item order.
 *
 * These are recorded as already-complete (status defaults to SHIPPED,
 * source MANUAL — the same "not from the storefront" source used for
 * staff-created orders) rather than run through payment or fulfilment.
 * Given an edition_number, this claims that exact Edition row (marking it
 * SOLD) so the print's real remaining-stock count stays accurate; if that
 * number doesn't exist or was already claimed by something else, the sale
 * is still recorded — just without linking a specific physical copy — and
 * reported back rather than silently dropped or allowed to corrupt stock.
 *
 * A row with an order_number matching an order already in the database
 * (from an earlier run of this same import) is skipped rather than
 * creating a duplicate, so a file can safely be re-uploaded — e.g. after
 * fixing a handful of rows that errored the first time. Rows with no
 * order_number can't be de-duplicated this way, since there's nothing to
 * match against: uploading the same "no order number" rows twice creates
 * two historical orders. Give a row an order_number if you might need to
 * re-upload the same file later.
 */

export const ORDERS_CSV_HEADER =
  "customer_email,order_date,print_title,print_slug,edition_number,quantity,price_gbp,shipping_gbp,order_number,status,note";

export function ordersCsvTemplate(): string {
  return [
    ORDERS_CSV_HEADER,
    "jane.smith@example.com,14/03/2019,Winter Study,,47,,145.00,0.00,ARCH-0001,SHIPPED,From the old paper order book",
    "john.doe@example.com,2020-11-02,Open Edition Mug,,,2,18.00,4.50,ARCH-0002,SHIPPED,",
  ].join("\n");
}

const VALID_STATUSES: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "PACKING", "PACKED", "SHIPPED", "CANCELLED", "REFUNDED"];

export type ParsedOrderRow = {
  lineNo: number;
  customerEmail: string;
  orderDate: Date;
  printTitle: string | null;
  printSlug: string | null;
  editionNumber: number | null;
  quantity: number;
  unitPriceMinor: number;
  shippingMinor: number;
  orderNumber: string | null;
  status: OrderStatus;
  note: string | null;
};

export function parseOrdersCsv(text: string): { rows: ParsedOrderRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: string[] = [];
  if (lines.length === 0) return { rows: [], errors: ["The file is empty."] };

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idx = {
    email: col("customer_email"),
    date: col("order_date"),
    title: col("print_title"),
    slug: col("print_slug"),
    edition: col("edition_number"),
    qty: col("quantity"),
    price: col("price_gbp"),
    shipping: col("shipping_gbp"),
    orderNumber: col("order_number"),
    status: col("status"),
    note: col("note"),
  };
  if (idx.email === -1 || idx.date === -1 || idx.price === -1 || (idx.title === -1 && idx.slug === -1)) {
    return {
      rows: [],
      errors: [
        `The file needs at least "customer_email", "order_date", "price_gbp", and either "print_title" or "print_slug" columns — found: ${header.join(", ")}`,
      ],
    };
  }

  const rows: ParsedOrderRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]);
    const lineNo = i + 1;

    const email = fields[idx.email]?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      errors.push(`Line ${lineNo}: missing or invalid customer_email — skipped.`);
      continue;
    }
    const orderDate = parseCsvDate(fields[idx.date]);
    if (!orderDate) {
      errors.push(`Line ${lineNo}: missing or unreadable order_date (use YYYY-MM-DD or DD/MM/YYYY) — skipped.`);
      continue;
    }
    const printTitle = stringCell(fields, idx.title);
    const printSlug = stringCell(fields, idx.slug);
    if (!printTitle && !printSlug) {
      errors.push(`Line ${lineNo}: needs a print_title or print_slug — skipped.`);
      continue;
    }
    const price = Number(fields[idx.price]);
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`Line ${lineNo}: missing or invalid price_gbp — skipped.`);
      continue;
    }
    const editionRaw = idx.edition >= 0 ? fields[idx.edition]?.trim() : "";
    const editionNumber = editionRaw ? Math.round(Number(editionRaw)) : null;
    if (editionRaw && (!Number.isFinite(editionNumber) || (editionNumber as number) <= 0)) {
      errors.push(`Line ${lineNo}: edition_number "${editionRaw}" isn't a valid number — ignored, sale still recorded.`);
    }
    const qtyRaw = idx.qty >= 0 ? fields[idx.qty]?.trim() : "";
    const quantity = qtyRaw ? Math.max(1, Math.min(50, Math.round(Number(qtyRaw)) || 1)) : 1;
    const shippingRaw = idx.shipping >= 0 ? fields[idx.shipping]?.trim() : "";
    const shippingMinor = shippingRaw && Number.isFinite(Number(shippingRaw)) ? Math.round(Number(shippingRaw) * 100) : 0;

    const statusRaw = (idx.status >= 0 ? fields[idx.status]?.trim().toUpperCase() : "") || "SHIPPED";
    let status: OrderStatus = "SHIPPED";
    if (VALID_STATUSES.includes(statusRaw as OrderStatus)) {
      status = statusRaw as OrderStatus;
    } else if (idx.status >= 0 && fields[idx.status]?.trim()) {
      errors.push(`Line ${lineNo}: status "${statusRaw}" isn't recognised — used SHIPPED instead.`);
    }

    rows.push({
      lineNo,
      customerEmail: email,
      orderDate,
      printTitle,
      printSlug,
      editionNumber: editionNumber && editionNumber > 0 ? editionNumber : null,
      quantity,
      unitPriceMinor: Math.round(price * 100),
      shippingMinor,
      orderNumber: stringCell(fields, idx.orderNumber),
      status,
      note: stringCell(fields, idx.note),
    });
  }
  return { rows, errors };
}

type OrderGroup = { orderNumber: string | null; rows: ParsedOrderRow[] };

function groupRows(rows: ParsedOrderRow[]): OrderGroup[] {
  const groups: OrderGroup[] = [];
  const byOrderNumber = new Map<string, OrderGroup>();
  for (const row of rows) {
    if (row.orderNumber) {
      let group = byOrderNumber.get(row.orderNumber);
      if (!group) {
        group = { orderNumber: row.orderNumber, rows: [] };
        byOrderNumber.set(row.orderNumber, group);
        groups.push(group);
      }
      group.rows.push(row);
    } else {
      groups.push({ orderNumber: null, rows: [row] });
    }
  }
  return groups;
}

/** Creates one historical Order per group of rows (see groupRows above).
 * Resolves each row's print by slug first, then an exact (case-insensitive)
 * title match; a row whose print can't be found is dropped from its order
 * with an error, and a group where every row fails this way is skipped
 * entirely. Everything for one order — the customer upsert, the order
 * itself, its items, and any edition allocation — happens in a single
 * transaction, so a mid-group failure can't leave a half-written order
 * behind. */
export async function applyOrdersImport(
  rows: ParsedOrderRow[]
): Promise<{ created: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const group of groupRows(rows)) {
    try {
      if (group.orderNumber) {
        const existingOrder = await prisma.order.findUnique({ where: { orderNumber: group.orderNumber } });
        if (existingOrder) {
          skipped++;
          errors.push(`Order ${group.orderNumber}: already exists — skipped (this file may have been imported before).`);
          continue;
        }
      }

      // Resolve each row's print up front, outside the transaction (Prisma
      // interactive transactions have a time limit, and print lookups don't
      // need to be inside it).
      const resolvedRows: { row: ParsedOrderRow; printId: string; printTitle: string; editionSize: number | null }[] = [];
      for (const row of group.rows) {
        const print = row.printSlug
          ? await prisma.print.findUnique({ where: { slug: row.printSlug } })
          : await prisma.print.findFirst({ where: { title: { equals: row.printTitle!, mode: "insensitive" } } });
        if (!print) {
          errors.push(
            `Line ${row.lineNo}: couldn't find a print matching ${row.printSlug ? `slug "${row.printSlug}"` : `title "${row.printTitle}"`} — this line was left out.`
          );
          continue;
        }
        resolvedRows.push({ row, printId: print.id, printTitle: print.title, editionSize: print.editionSize });
      }
      if (resolvedRows.length === 0) {
        skipped++;
        errors.push(
          `${group.orderNumber ? `Order ${group.orderNumber}` : `Line ${group.rows[0].lineNo}`}: no line items could be matched to a print — order not created.`
        );
        continue;
      }

      const email = group.rows[0].customerEmail;
      const orderDate = group.rows[0].orderDate;
      const orderNumber = group.orderNumber || generateOrderNumber();
      const status = group.rows[0].status;
      const shippingMinor = group.rows.reduce((sum, r) => sum + r.shippingMinor, 0);
      const note = group.rows.map((r) => r.note).filter(Boolean).join(" / ") || null;

      await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.upsert({
          where: { email },
          update: {},
          create: { email },
        });

        const itemsData: { printId: string; unitPriceMinor: number; requestedEditionNumber: number | null; editionId?: string }[] = [];
        const editionClaims: { printId: string; number: number }[] = [];

        for (const { row, printId, printTitle, editionSize } of resolvedRows) {
          if (row.editionNumber && editionSize !== null) {
            const edition = await tx.edition.findUnique({ where: { printId_number: { printId, number: row.editionNumber } } });
            if (edition && edition.status === "AVAILABLE") {
              itemsData.push({ printId, unitPriceMinor: row.unitPriceMinor, requestedEditionNumber: row.editionNumber, editionId: edition.id });
              editionClaims.push({ printId, number: row.editionNumber });
            } else {
              errors.push(
                `Line ${row.lineNo}: edition #${row.editionNumber} of "${printTitle}" ${edition ? `is already ${edition.status.toLowerCase()}` : "doesn't exist"} — sale recorded without linking a specific copy.`
              );
              itemsData.push({ printId, unitPriceMinor: row.unitPriceMinor, requestedEditionNumber: row.editionNumber });
            }
          } else {
            for (let i = 0; i < row.quantity; i++) {
              itemsData.push({ printId, unitPriceMinor: row.unitPriceMinor, requestedEditionNumber: null });
            }
          }
        }

        const subtotalMinor = itemsData.reduce((sum, i) => sum + i.unitPriceMinor, 0);

        await tx.order.create({
          data: {
            orderNumber,
            customerId: customer.id,
            status,
            source: "MANUAL",
            customerNote: note || undefined,
            subtotalMinor,
            shippingMinor,
            totalMinor: subtotalMinor + shippingMinor,
            createdAt: orderDate,
            items: { create: itemsData },
          },
        });

        for (const claim of editionClaims) {
          await tx.edition.update({
            where: { printId_number: { printId: claim.printId, number: claim.number } },
            data: { status: "SOLD", soldAt: orderDate, reservedAt: null, reservedUntil: null, reservationToken: null },
          });
        }
      });

      created++;
    } catch (err: any) {
      skipped++;
      errors.push(`${group.orderNumber ? `Order ${group.orderNumber}` : `Line ${group.rows[0].lineNo}`}: ${err?.message || "Couldn't save this order."}`);
    }
  }

  return { created, skipped, errors };
}
