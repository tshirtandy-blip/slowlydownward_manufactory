import { getKpis, getRevenueSeries, getTopPrints } from "@/lib/reports";
import { getLiveActivity } from "@/lib/analytics";
import { formatMinor } from "@/lib/money";
import { StatTile } from "@/components/admin/StatTile";
import { LiveStatsWidgets } from "@/components/admin/LiveStatsWidgets";
import { RevenueChart, TopPrintsChart } from "@/components/admin/DashboardCharts";
import { AutoRefresh } from "@/components/admin/AutoRefresh";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const [kpis, revenue, topPrints, liveActivity] = await Promise.all([
    getKpis(),
    getRevenueSeries(14),
    getTopPrints(5),
    getLiveActivity(),
  ]);

  return (
    <div>
      <AutoRefresh intervalMs={20_000} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl">Live stats</h1>
        <p className="text-xs text-stone">Updating automatically</p>
      </div>

      <div className="mb-10">
        <LiveStatsWidgets initial={liveActivity} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatTile label="Revenue today" value={formatMinor(kpis.revenueTodayMinor)} />
        <StatTile label="Revenue this week" value={formatMinor(kpis.revenueWeekMinor)} />
        <StatTile label="Orders today" value={String(kpis.ordersToday)} />
        <StatTile
          label="Awaiting packing"
          value={String(kpis.awaitingPacking)}
          hint={kpis.awaitingPacking > 0 ? "Check the packing queue" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="border hairline p-6">
          <h2 className="label-caps mb-4">Revenue — last 14 days</h2>
          <RevenueChart data={revenue} />
        </div>
        <div className="border hairline p-6">
          <h2 className="label-caps mb-4">Top prints by units sold</h2>
          {topPrints.length > 0 ? (
            <TopPrintsChart data={topPrints} />
          ) : (
            <p className="text-stone text-sm py-16 text-center">No sales yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
