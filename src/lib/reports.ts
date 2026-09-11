import { prisma } from "@/lib/prisma";
import { startOfDay, startOfWeek, subDays, format } from "date-fns";

const PAID_STATUSES = ["PAID", "PACKING", "PACKED", "SHIPPED"] as const;

export async function getKpis() {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const [ordersToday, revenueToday, revenueWeek, editionsAvailable, awaitingPacking] = await Promise.all([
    prisma.order.count({ where: { status: { in: PAID_STATUSES as any }, createdAt: { gte: today } } }),
    prisma.order.aggregate({
      _sum: { totalMinor: true },
      where: { status: { in: PAID_STATUSES as any }, createdAt: { gte: today } },
    }),
    prisma.order.aggregate({
      _sum: { totalMinor: true },
      where: { status: { in: PAID_STATUSES as any }, createdAt: { gte: weekStart } },
    }),
    prisma.edition.count({ where: { status: "AVAILABLE" } }),
    prisma.order.count({ where: { status: "PAID" } }),
  ]);

  return {
    ordersToday,
    revenueTodayMinor: revenueToday._sum.totalMinor ?? 0,
    revenueWeekMinor: revenueWeek._sum.totalMinor ?? 0,
    editionsAvailable,
    awaitingPacking,
  };
}

export async function getRevenueSeries(days = 14) {
  const since = subDays(startOfDay(new Date()), days - 1);
  const orders = await prisma.order.findMany({
    where: { status: { in: PAID_STATUSES as any }, createdAt: { gte: since } },
    select: { totalMinor: true, createdAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    buckets.set(format(subDays(new Date(), days - 1 - i), "MMM d"), 0);
  }
  for (const order of orders) {
    const key = format(order.createdAt, "MMM d");
    buckets.set(key, (buckets.get(key) ?? 0) + order.totalMinor / 100);
  }
  return Array.from(buckets.entries()).map(([date, revenue]) => ({ date, revenue }));
}

export async function getTopPrints(limit = 5) {
  const grouped = await prisma.orderItem.groupBy({
    by: ["printId"],
    _count: { _all: true },
    orderBy: { _count: { printId: "desc" } },
    take: limit,
  });
  const prints = await prisma.print.findMany({ where: { id: { in: grouped.map((g) => g.printId) } } });
  const printMap = new Map(prints.map((p) => [p.id, p]));
  return grouped.map((g) => ({
    title: printMap.get(g.printId)?.title ?? "Unknown",
    units: g._count._all,
  }));
}

export async function getStockBreakdown() {
  const grouped = await prisma.edition.groupBy({ by: ["status"], _count: { _all: true } });
  const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
  return grouped.map((g) => ({ status: g.status, count: g._count._all, total }));
}
