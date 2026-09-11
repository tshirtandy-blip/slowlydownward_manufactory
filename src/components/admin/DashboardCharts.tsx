"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

// Reference palette (see dataviz skill) — sequential blue for magnitude,
// status colors reserved for edition stock states.
const COLORS = {
  seqBlue: "#2a78d6",
  seqBlueLight: "#cde2fb",
  ink: "#0b0b0b",
  secondary: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  surface: "#fcfcfb",
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  SOLD: "Sold",
  WITHHELD: "Withheld",
  DAMAGED: "Damaged",
};

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: COLORS.good,
  RESERVED: COLORS.warning,
  SOLD: COLORS.muted,
  WITHHELD: COLORS.serious,
  DAMAGED: COLORS.critical,
};

function CustomTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border hairline px-3 py-2 text-xs shadow-sm">
      <p className="text-stone mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

export function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.seqBlue} stopOpacity={0.25} />
            <stop offset="100%" stopColor={COLORS.seqBlue} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={COLORS.grid} />
        <XAxis
          dataKey="date"
          tick={{ fill: COLORS.muted, fontSize: 11 }}
          axisLine={{ stroke: COLORS.grid }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: COLORS.muted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `£${v}`}
          width={48}
        />
        <Tooltip content={<CustomTooltip formatter={(v: number) => `£${v.toFixed(2)}`} />} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke={COLORS.seqBlue}
          strokeWidth={2}
          fill="url(#revenueFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TopPrintsChart({ data }: { data: { title: string; units: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={COLORS.grid} />
        <XAxis type="number" tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="title"
          width={140}
          tick={{ fill: COLORS.secondary, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip formatter={(v: number) => `${v} sold`} />} />
        <Bar dataKey="units" fill={COLORS.seqBlue} radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StockBreakdownBar({ data }: { data: { status: string; count: number; total: number }[] }) {
  const total = data[0]?.total || data.reduce((s, d) => s + d.count, 0) || 1;
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-sm border hairline">
        {data.map((d) => (
          <div
            key={d.status}
            style={{ width: `${(d.count / total) * 100}%`, backgroundColor: STATUS_COLORS[d.status] }}
            title={`${STATUS_LABELS[d.status]}: ${d.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
        {data.map((d) => (
          <div key={d.status} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.status] }} />
            <span className="text-ink">{STATUS_LABELS[d.status]}</span>
            <span className="text-stone">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
