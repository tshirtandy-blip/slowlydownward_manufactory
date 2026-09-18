import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getReportType } from "@/lib/report-types";
import { ReportTable } from "@/components/admin/ReportTable";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { deleteSavedReport } from "../../actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SavedReportPage({ params }: { params: { id: string } }) {
  const saved = await prisma.savedReport.findUnique({ where: { id: params.id } });
  if (!saved) notFound();

  const reportType = getReportType(saved.type);
  if (!reportType) notFound();

  const savedParams = saved.params as { from?: string; to?: string };
  const table = await reportType.run(savedParams);
  const exportHref = `/admin/reports/export?type=${saved.type}${savedParams.from ? `&from=${savedParams.from}` : ""}${
    savedParams.to ? `&to=${savedParams.to}` : ""
  }`;

  return (
    <div className="max-w-4xl">
      <Link href="/admin/reports" className="label-caps text-stone hover:text-ink">
        ← Reports
      </Link>
      <div className="mt-2 mb-1 flex items-center justify-between">
        <h1 className="font-display text-2xl">{saved.name}</h1>
        <form action={deleteSavedReport.bind(null, saved.id)}>
          <ConfirmSubmitButton
            confirmText={`Delete the saved report "${saved.name}"? This only removes the saved shortcut — nothing about your sales or stock data changes.`}
            className="text-xs text-stone hover:text-accent"
          >
            Delete saved report
          </ConfirmSubmitButton>
        </form>
      </div>
      <p className="text-sm text-stone">{reportType.label}</p>
      {reportType.needsDateRange && (
        <p className="mb-8 text-xs text-stone">
          {savedParams.from || savedParams.to
            ? `${savedParams.from || "the beginning"} to ${savedParams.to || "today"}`
            : "Last 30 days"}{" "}
          — re-run fresh every time you open this page.
        </p>
      )}

      <div className="mb-6">
        <Button asChild variant="secondary">
          <a href={exportHref}>Export CSV</a>
        </Button>
      </div>

      <ReportTable table={table} />
    </div>
  );
}
