import Link from "next/link";
import { notFound } from "next/navigation";
import { getReportType } from "@/lib/report-types";
import { saveReport } from "../../actions";
import { ReportTable } from "@/components/admin/ReportTable";
import { SaveButton } from "@/components/admin/SaveButton";

export const dynamic = "force-dynamic";

export default async function RunReportPage({
  params,
  searchParams,
}: {
  params: { type: string };
  searchParams: { from?: string; to?: string };
}) {
  const reportType = getReportType(params.type);
  if (!reportType) notFound();

  const from = searchParams.from ?? "";
  const to = searchParams.to ?? "";
  const table = await reportType.run({ from: from || undefined, to: to || undefined });

  const exportHref = `/admin/reports/export?type=${reportType.key}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;

  return (
    <div className="max-w-4xl">
      <Link href="/admin/reports" className="label-caps text-stone hover:text-ink">
        ← Reports
      </Link>
      <h1 className="font-display text-2xl mt-2 mb-1">{reportType.label}</h1>
      <p className="text-sm text-stone mb-8">{reportType.description}</p>

      {reportType.needsDateRange && (
        <form method="get" className="flex items-end gap-3 mb-6">
          <div>
            <label className="label-caps block mb-2">From</label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="border hairline bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="label-caps block mb-2">To</label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="border hairline bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="btn-secondary !px-4 !py-2">
            Update
          </button>
          <p className="text-xs text-stone pb-2.5">Defaults to the last 30 days if left blank.</p>
        </form>
      )}

      <div className="flex items-center gap-4 mb-6">
        <a href={exportHref} className="btn-secondary !px-4 !py-2">
          Export CSV
        </a>
        <form action={saveReport} className="flex items-center gap-2">
          <input type="hidden" name="type" value={reportType.key} />
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <input
            name="name"
            placeholder="Name this report to save it…"
            className="border hairline bg-transparent px-3 py-2 text-sm w-56"
          />
          <SaveButton className="btn-secondary !px-4 !py-2">Save</SaveButton>
        </form>
      </div>

      <ReportTable table={table} />
    </div>
  );
}
