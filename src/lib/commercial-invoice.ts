import PDFDocument from "pdfkit";
import type { Order, OrderItem, Print } from "@prisma/client";
import { formatMinor } from "@/lib/money";
import { countryName } from "@/lib/countries";
import { getCustomsSummary } from "@/lib/customs";
import type { ShippingAddress } from "@/lib/integrations/ups";

/**
 * Builds a commercial invoice PDF for one order — the document customs
 * authorities require for any shipment leaving the UK (Europe and
 * rest-of-world zones; not needed for UK domestic parcels). Two uses:
 *
 *  1. Uploaded to UPS's Paperless Documents API and referenced on the
 *     shipment, so no printed copy needs to travel inside the parcel
 *     ("paperless" customs — see src/lib/integrations/ups.ts).
 *  2. Available to download/print from the order page regardless, as a
 *     record for the shop and a fallback if the electronic upload fails or
 *     a different carrier is used.
 *
 * This is a plain, functional layout, not a styled brand document — customs
 * offices care about the data being present and legible, not its design.
 */

type OrderWithItems = Order & { items: (OrderItem & { print: Print })[] };

export async function buildCommercialInvoicePdf(params: {
  order: OrderWithItems;
  shipFrom: ShippingAddress;
  shipTo: ShippingAddress;
}): Promise<Buffer> {
  const { order, shipFrom, shipTo } = params;
  const customs = getCustomsSummary(order, shipFrom.countryCode);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Commercial Invoice", { align: "right" });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor("#555").text(`Invoice / order no: ${order.orderNumber}`, { align: "right" });
    doc.text(`Date: ${order.createdAt.toLocaleDateString("en-GB")}`, { align: "right" });
    doc.fillColor("#000");
    doc.moveDown(1.2);

    const colY = doc.y;
    doc.fontSize(10).font("Helvetica-Bold").text("Shipper (exporter)", 50, colY);
    doc.font("Helvetica-Bold").text("Consignee (importer)", 310, colY);
    doc.font("Helvetica").fontSize(9);
    doc.text(
      [shipFrom.name, shipFrom.line1, shipFrom.line2, shipFrom.city, shipFrom.postalCode, countryName(shipFrom.countryCode)]
        .filter(Boolean)
        .join("\n"),
      50,
      colY + 16,
      { width: 240 }
    );
    doc.text(
      [shipTo.name, shipTo.line1, shipTo.line2, shipTo.city, shipTo.postalCode, countryName(shipTo.countryCode)]
        .filter(Boolean)
        .join("\n"),
      310,
      colY + 16,
      { width: 240 }
    );

    doc.moveDown(6);
    doc.font("Helvetica").fontSize(9);
    doc.text(`Reason for export: Sale of goods`, 50);
    doc.text(`Terms of sale (Incoterms): DAP (Delivered at Place)`, 50);
    doc.text(`Country of origin of goods: ${countryName(shipFrom.countryCode)}`, 50);
    doc.text(`Currency: ${order.currency}`, 50);
    doc.moveDown(1);

    // Line items table
    const tableTop = doc.y;
    const cols = { desc: 50, hs: 260, qty: 340, unit: 380, total: 460 };
    doc.font("Helvetica-Bold").fontSize(9);
    doc.text("Description", cols.desc, tableTop);
    doc.text("HS code", cols.hs, tableTop);
    doc.text("Qty", cols.qty, tableTop);
    doc.text("Unit value", cols.unit, tableTop);
    doc.text("Total", cols.total, tableTop);
    doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).strokeColor("#ccc").stroke();

    let y = tableTop + 20;
    doc.font("Helvetica").fontSize(9);
    for (const line of customs.lines) {
      doc.text(line.description, cols.desc, y, { width: 200 });
      doc.text(line.hsCode, cols.hs, y);
      doc.text(String(line.quantity), cols.qty, y);
      doc.text(formatMinor(line.unitValueMinor, order.currency), cols.unit, y);
      doc.text(formatMinor(line.totalValueMinor, order.currency), cols.total, y);
      y += 20;
    }

    doc.moveTo(50, y).lineTo(545, y).strokeColor("#ccc").stroke();
    y += 10;
    doc.font("Helvetica-Bold");
    doc.text(`Total declared value: ${formatMinor(customs.totalValueMinor, order.currency)}`, cols.hs, y);
    y += 16;
    doc.font("Helvetica").fontSize(8).fillColor("#555");
    doc.text(`Total weight: ${(customs.totalWeightGrams / 1000).toFixed(2)} kg`, 50, y);
    doc.fillColor("#000");
    y += 30;

    doc.font("Helvetica").fontSize(8).fillColor("#555").text(
      "I declare that the information given in this invoice is true and correct to the best of my knowledge. " +
        "These commodities are licensed for the ultimate destination shown and may not be resold, transferred, " +
        "or otherwise disposed of except as authorised by law.",
      50,
      y,
      { width: 495 }
    );
    y += 40;
    doc.fillColor("#000").text("Signed: ___________________________", 50, y);
    doc.text(shipFrom.name, 50, y + 16);

    doc.end();
  });
}
