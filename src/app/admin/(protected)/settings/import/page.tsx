import Link from "next/link";
import { IMPORT_TYPES } from "@/lib/imports/registry";

export const dynamic = "force-dynamic";

export default function ImportHubPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl mb-2">Import data</h1>
      <p className="text-sm text-stone mb-8">
        Bring in data from a spreadsheet — archival client records, historical purchases, or a batch of
        products (e.g. migrating your old Shopify catalogue). Pick what you're importing below, download the
        template for it, fill it in, and upload it back here.
      </p>

      <div className="border hairline">
        <table className="w-full text-sm">
          <thead>
            <tr className="label-caps text-left border-b hairline">
              <th className="p-3">What to import</th>
              <th className="p-3">Details</th>
              <th className="p-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {IMPORT_TYPES.map((type) => (
              <tr key={type.key} className="border-b hairline last:border-0 hover:bg-line/40">
                <td className="p-3 font-medium">
                  <Link href={`/admin/settings/import/${type.key}`} className="underline">
                    {type.label}
                  </Link>
                </td>
                <td className="p-3 text-stone">{type.description}</td>
                <td className="p-3">
                  <Link href={`/admin/settings/import/${type.key}`} className="text-xs underline text-stone hover:text-ink">
                    Start →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
