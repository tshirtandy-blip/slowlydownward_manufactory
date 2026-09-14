import type { ReportTable as ReportTableData } from "@/lib/report-types";

export function ReportTable({ table }: { table: ReportTableData }) {
  if (table.rows.length === 0) {
    return <p className="text-stone text-sm py-16 text-center border hairline">No data for this range yet.</p>;
  }

  return (
    <div className="border hairline overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="label-caps text-left border-b hairline">
            {table.columns.map((c) => (
              <th key={c} className="p-3 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-b hairline last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="p-3 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
