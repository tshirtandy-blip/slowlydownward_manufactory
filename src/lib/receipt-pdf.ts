import PDFDocument from "pdfkit";
import type { Order, OrderItem, Print, Edition, Customer } from "@prisma/client";
import { formatMinor } from "@/lib/money";

/**
 * Builds a downloadable receipt PDF for one order — the customer-facing
 * counterpart to src/lib/commercial-invoice.ts's admin/customs document.
 * Same pdfkit approach (plain A4, manual x/y layout, buffer-via-stream)
 * since it needs no native binary and already proved simple and reliable
 * there; no need for the puppeteer/chromium machinery src/lib/coa-pdf.ts
 * uses for owner-authored HTML/CSS templates — a receipt's layout is
 * fixed, not something the owner designs per product.
 *
 * Each OrderItem row is one physical unit (see scripts/import-shopify-
 * orders.ts and src/lib/imports/orders-import.ts, which both explode a
 * quantity into one row per unit), so items are listed one line each with
 * no separate quantity column — matching how /account/orders already
 * renders them.
 */

type ItemWithRelations = OrderItem & { print: Print; edition: Edition | null };

export async function buildReceiptPdf(params: {
  order: Order;
  items: ItemWithRelations[];
  customer: Pick<Customer, "email" | "firstName" | "lastName">;
}): Promise<Buffer> {
  const { order, items, customer } = params;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Slowly Downward", { align: "left" });
    doc.fontSize(11).fillColor("#555").text("Receipt", { align: "left" });
    doc.fillColor("#000");
    doc.moveDown(1);

    doc.fontSize(9).fillColor("#555");
    doc.text(`Order: ${order.orderNumber}`);
    doc.text(
      `Date: ${order.createdAt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}`
    );
    const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || order.shippingName;
    if (customerName) doc.text(`Customer: ${customerName}`);
    doc.text(`Email: ${customer.email}`);
    doc.fillColor("#000");
    doc.moveDown(1.2);

    const tableTop = doc.y;
    const cols = { desc: 50, price: 460 };
    doc.font("Helvetica-Bold").fontSize(9);
    doc.text("Item", cols.desc, tableTop);
    doc.text("Price", cols.price, tableTop);
    doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).strokeColor("#ccc").stroke();

    let y = tableTop + 20;
    doc.font("Helvetica").fontSize(9);
    for (const item of items) {
      const label = item.print.title + (item.edition ? ` — edition #${item.edition.number}` : "");
      doc.text(label, cols.desc, y, { width: 380 });
      doc.text(formatMinor(item.unitPriceMinor, order.currency), cols.price, y);
      y += 20;
    }

    doc.moveTo(50, y).lineTo(545, y).strokeColor("#ccc").stroke();
    y += 10;
    doc.font("Helvetica").fontSize(9);
    doc.text("Subtotal", cols.desc, y);
    doc.text(formatMinor(order.subtotalMinor, order.currency), cols.price, y);
    y += 16;
    doc.text("Shipping", cols.desc, y);
    doc.text(formatMinor(order.shippingMinor, order.currency), cols.price, y);
    y += 16;
    doc.font("Helvetica-Bold");
    doc.text("Total", cols.desc, y);
    doc.text(formatMinor(order.totalMinor, order.currency), cols.price, y);
    y += 40;

    doc.font("Helvetica").fontSize(8).fillColor("#555").text("Thank you for your order.", 50, y);

    doc.end();
  });
}
