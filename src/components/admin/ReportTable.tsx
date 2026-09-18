import type { ReportTable as ReportTableData } from "@/lib/report-types";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ReportTable({ table }: { table: ReportTableData }) {
  if (table.rows.length === 0) {
    return <p className="border border-line py-16 text-center text-sm text-stone">No data for this range yet.</p>;
  }

  return (
    <Card className="border-line shadow-none">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {table.columns.map((c) => (
                <TableHead key={c} className="whitespace-nowrap">
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.map((row, i) => (
              <TableRow key={i}>
                {row.map((cell, j) => (
                  <TableCell key={j} className="whitespace-nowrap">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
