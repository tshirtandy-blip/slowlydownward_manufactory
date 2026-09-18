import Link from "next/link";
import { IMPORT_TYPES } from "@/lib/imports/registry";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default function ImportHubPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl mb-2">Import data</h1>
      <p className="mb-8 text-sm text-stone">
        Bring in data from a spreadsheet — archival client records, historical purchases, or a batch of
        products (e.g. migrating your old Shopify catalogue). Pick what you're importing below, download the
        template for it, fill it in, and upload it back here.
      </p>

      <Card className="border-line shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-line">
                <TableHead className="label-caps">What to import</TableHead>
                <TableHead className="label-caps">Details</TableHead>
                <TableHead className="label-caps w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {IMPORT_TYPES.map((type) => (
                <TableRow key={type.key} className="border-line">
                  <TableCell className="font-medium">
                    <Link href={`/admin/settings/import/${type.key}`} className="underline">
                      {type.label}
                    </Link>
                  </TableCell>
                  <TableCell className="text-stone">{type.description}</TableCell>
                  <TableCell>
                    <Link href={`/admin/settings/import/${type.key}`} className="text-xs text-stone underline hover:text-ink">
                      Start →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
