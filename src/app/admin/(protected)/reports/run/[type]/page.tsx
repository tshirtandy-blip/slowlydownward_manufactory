import Link from "next/link";
import { notFound } from "next/navigation";
import { getReportType } from "@/lib/report-types";
import { saveReport } from "../../actions";
import { ReportTable } from "@/components/admin/ReportTable";
import { SaveButton } from "@/components/admin/SaveButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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
      <p className="mb-8 text-sm text-stone">{reportType.description}</p>

      {reportType.needsDateRange && (
        <form method="get" className="mb-6 flex items-end gap-3">
          <div>
            <Label htmlFor="reportFrom" className="label-caps mb-2 block">
              From
            </Label>
            <Input id="reportFrom" type="date" name="from" defaultValue={from} className="border-line" />
          </div>
          <div>
            <Label htmlFor="reportTo" className="label-caps mb-2 block">
              To
            </Label>
            <Input id="reportTo" type="date" name="to" defaultValue={to} className="border-line" />
          </div>
          <Button type="submit" variant="secondary">
            Update
          </Button>
          <p className="pb-2.5 text-xs text-stone">Defaults to the last 30 days if left blank.</p>
        </form>
      )}

      <div className="mb-6 flex items-center gap-4">
        <Button asChild variant="secondary">
          <a href={exportHref}>Export CSV</a>
        </Button>
        <form action={saveReport} className="flex items-center gap-2">
          <input type="hidden" name="type" value={reportType.key} />
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <Input name="name" placeholder="Name this report to save it…" className="w-56 border-line" />
          <SaveButton>Save</SaveButton>
        </form>
      </div>

      <ReportTable table={table} />
    </div>
  );
}
