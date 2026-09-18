import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { REPORT_TYPES, getReportType } from "@/lib/report-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
          <Link key={rt.key} href={`/admin/reports/run/${rt.key}`} className="block">
            <Card className="h-full border-line shadow-none transition-colors hover:border-ink">
              <CardHeader>
                <CardTitle className="font-display text-lg font-normal">{rt.label}</CardTitle>
                <CardDescription>{rt.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="label-caps mb-3">Saved reports</h2>
      <Card className="border-line shadow-none">
        <CardContent className="p-0">
          {savedReports.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Saved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedReports.map((r) => {
                  const rt = getReportType(r.type);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link href={`/admin/reports/saved/${r.id}`} className="hover:underline">
                          {r.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-stone">{rt?.label ?? r.type}</TableCell>
                      <TableCell className="text-stone">{r.createdAt.toLocaleDateString("en-GB")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="px-4 py-8 text-sm text-stone text-center">
              No saved reports yet — run one above and give it a name to save it.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
