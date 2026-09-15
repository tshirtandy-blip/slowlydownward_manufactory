import Link from "next/link";
import { notFound } from "next/navigation";
import { getImportType } from "@/lib/imports/registry";
import { ImportCsvForm } from "./ImportCsvForm";

export const dynamic = "force-dynamic";

export default function ImportTypePage({ params }: { params: { type: string } }) {
  const type = getImportType(params.type);
  if (!type) notFound();

  const columns = type.columnsHeader.split(",");

  return (
    <div className="max-w-2xl">
      <Link href="/admin/settings/import" className="text-xs underline text-stone hover:text-ink">
        ← Import data
      </Link>

      <h1 className="font-display text-2xl mt-3 mb-2">Import: {type.label}</h1>
      <p className="text-sm text-stone mb-6">{type.description}</p>

      <div className="border hairline p-5 mb-6">
        <h3 className="label-caps mb-2">1. Get the template</h3>
        <p className="text-sm text-stone mb-3">
          Download the template below and fill in one row per {type.key === "products" ? "print" : type.key === "orders" ? "purchase" : "client"}
          , then save it as a CSV (any spreadsheet program can do this from File &gt; Save As / Export). Column order
          doesn't matter, but the column names on the first row need to stay as they are.
        </p>
        <a
          href={`/admin/settings/import/${type.key}/template`}
          className="text-xs underline text-stone hover:text-ink"
        >
          Download template CSV
        </a>
        <div className="mt-4 border-t hairline pt-3">
          <p className="label-caps text-stone mb-1">Columns</p>
          <ul className="text-xs text-stone space-y-0.5">
            {columns.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mb-2">
        <h3 className="label-caps mb-2">2. Upload it</h3>
      </div>
      <ImportCsvForm typeKey={type.key} typeLabel={type.label} />
    </div>
  );
}
