import { prisma } from "@/lib/prisma";
import { PAID_STATUSES } from "@/lib/reports";
import { format } from "date-fns";

export type ReportTable = { columns: string[]; rows: (string | number)[][] };
export type ReportParams = { from?: string; to?: string };

export type ReportType = {
  key: string;
  label: string;
  description: string;
  // Stock is a live snapshot — a date range doesn't mean anything for it.
  needsDateRange: boolean;
  run: (params: ReportParams) => Promise<ReportTable>;
};

function dateRange(params: ReportParams) {
  const to = params.to ? new Date(params.to + "T23:59:59.999Z") : new Date();
  const from = params.from ? new Date(params.from + "T00:00:00.000Z") : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

function money(minor: number) {
  return (minor / 100).toFixed(2);
}

async function salesByMonth(params: ReportParams): Promise<ReportTable> {
  const { from, to } = dateRange(params);
  const orders = await prisma.order.findMany({
    where: { status: { in: PAID_STATUSES as any }, createdAt: { gte: from, lte: to } },
    include: { items: true },
  });

  const buckets = new Map<string, { orders: number; units: number; revenueMinor: number; shippingMinor: number }>();
  for (const order of orders) {
    const key = format(order.createdAt, "yyyy-MM");
    const bucket = buckets.get(key) ?? { orders: 0, units: 0, revenueMinor: 0, shippingMinor: 0 };
    bucket.orders += 1;
    bucket.units += order.items.length;
    bucket.revenueMinor += order.totalMinor;
    bucket.shippingMinor += order.shippingMinor;
    buckets.set(key, bucket);
  }

  const rows = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, b]) => [format(new Date(month + "-01"), "MMMM yyyy"), b.orders, b.units, money(b.revenueMinor), money(b.shippingMinor)]);

  return { columns: ["Month", "Orders", "Units", "Revenue (£)", "Shipping (£)"], rows };
}

async function salesByProduct(params: ReportParams): Promise<ReportTable> {
  const { from, to } = dateRange(params);
  const items = await prisma.orderItem.findMany({
    where: { order: { status: { in: PAID_STATUSES as any }, createdAt: { gte: from, lte: to } } },
    include: { print: true },
  });

  const byPrint = new Map<string, { title: string; units: number; revenueMinor: number }>();
  for (const item of items) {
    const bucket = byPrint.get(item.printId) ?? { title: item.print.title, units: 0, revenueMinor: 0 };
    bucket.units += 1;
    bucket.revenueMinor += item.unitPriceMinor;
    byPrint.set(item.printId, bucket);
  }

  const rows = Array.from(byPrint.values())
    .sort((a, b) => b.revenueMinor - a.revenueMinor)
    .map((b) => [b.title, b.units, money(b.revenueMinor)]);

  return { columns: ["Print", "Units sold", "Revenue (£)"], rows };
}

async function salesByCountry(params: ReportParams): Promise<ReportTable> {
  const { from, to } = dateRange(params);
  const orders = await prisma.order.findMany({
    where: { status: { in: PAID_STATUSES as any }, createdAt: { gte: from, lte: to } },
    select: { shippingAddress: true, totalMinor: true, shippingMinor: true },
  });

  const byCountry = new Map<string, { orders: number; revenueMinor: number; shippingMinor: number }>();
  for (const order of orders) {
    const address = order.shippingAddress as any;
    const country = address?.country || "Unknown";
    const bucket = byCountry.get(country) ?? { orders: 0, revenueMinor: 0, shippingMinor: 0 };
    bucket.orders += 1;
    bucket.revenueMinor += order.totalMinor;
    bucket.shippingMinor += order.shippingMinor;
    byCountry.set(country, bucket);
  }

  const rows = Array.from(byCountry.entries())
    .sort(([, a], [, b]) => b.revenueMinor - a.revenueMinor)
    .map(([country, b]) => [country, b.orders, money(b.revenueMinor), money(b.shippingMinor)]);

  return { columns: ["Country", "Orders", "Revenue (£)", "Shipping collected (£)"], rows };
}

async function stockSnapshot(): Promise<ReportTable> {
  const prints = await prisma.print.findMany({
    include: { editions: { select: { status: true } } },
    orderBy: { title: "asc" },
  });

  const rows = prints.map((p) => {
    if (p.editionSize === null) {
      return [p.title, "Open edition", "—", "—", "—", "—", "—"];
    }
    const counts: Record<string, number> = {};
    for (const e of p.editions) counts[e.status] = (counts[e.status] ?? 0) + 1;
    return [
      p.title,
      p.editionSize,
      counts.AVAILABLE ?? 0,
      counts.SOLD ?? 0,
      counts.RESERVED ?? 0,
      counts.WITHHELD ?? 0,
      counts.DAMAGED ?? 0,
    ];
  });

  return { columns: ["Print", "Edition size", "Available", "Sold", "Reserved", "Withheld", "Damaged"], rows };
}

// The registry — add another entry here for any new report; every page in
// /admin/reports drives off this list, so nothing else needs to change to
// make a new report type show up, be runnable, exportable, and saveable.
export const REPORT_TYPES: ReportType[] = [
  {
    key: "sales_by_month",
    label: "Sales by month",
    description: "Orders, units, revenue and shipping collected, grouped by calendar month.",
    needsDateRange: true,
    run: salesByMonth,
  },
  {
    key: "sales_by_product",
    label: "Sales by product",
    description: "Units sold and revenue for each print.",
    needsDateRange: true,
    run: salesByProduct,
  },
  {
    key: "sales_by_country",
    label: "Sales by dispatch country",
    description: "Orders, revenue and shipping collected, grouped by the country each order shipped to.",
    needsDateRange: true,
    run: salesByCountry,
  },
  {
    key: "stock",
    label: "Stock report",
    description: "A current snapshot of every print's edition status — available, sold, reserved, withheld, damaged.",
    needsDateRange: false,
    run: stockSnapshot,
  },
];

export function getReportType(key: string): ReportType | undefined {
  return REPORT_TYPES.find((r) => r.key === key);
}

export function toCsv(table: ReportTable): string {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [table.columns.map(escape).join(",")];
  for (const row of table.rows) lines.push(row.map(escape).join(","));
  return lines.join("\n");
}
