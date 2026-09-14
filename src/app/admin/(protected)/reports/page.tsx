import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { REPORT_TYPES, getReportType } from "@/lib/report-types";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const savedReports = await prisma.savedReport.findMany({ orderBy: { updatedAt: "desc" } });

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl mb-2">Reports</h1>
      <p className="text-sm text-stone mb-10">
        Run any report below, then save it with a name to come back to it later — a saved report always runs
        against current data, not a frozen copy. More report types can be added here as you need them.
      </p>

      <h2 className="label-caps mb-3">Report types</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {REPORT_TYPES.map((rt) => (
          <Link key={rt.key} href={`/admin/reports/run/${rt.key}`} className="border hairline p-5 hover:border-ink block">
            <h3 className="font-display text-lg mb-1">{rt.label}</h3>
            <p className="text-sm text-stone">{rt.description}</p>
          </Link>
        ))}
      </div>

      <h2 className="label-caps mb-3">Saved reports</h2>
      <div className="border hairline">
        {savedReports.map((r) => {
          const rt = getReportType(r.type);
          return (
            <Link
              key={r.id}
              href={`/admin/reports/saved/${r.id}`}
              className="flex items-center justify-between px-4 py-3 border-b hairline last:border-0 hover:bg-line/40"
            >
              <div>
                <p className="text-sm">{r.name}</p>
                <p className="text-xs text-stone">{rt?.label ?? r.type}</p>
              </div>
              <span className="text-xs text-stone">Saved {r.createdAt.toLocaleDateString("en-GB")}</span>
            </Link>
          );
        })}
        {savedReports.length === 0 && (
          <p className="px-4 py-8 text-sm text-stone text-center">
            No saved reports yet — run one above and give it a name to save it.
          </p>
        )}
      </div>
    </div>
  );
}
