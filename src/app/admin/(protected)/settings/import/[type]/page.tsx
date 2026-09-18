import Link from "next/link";
import { notFound } from "next/navigation";
import { getImportType } from "@/lib/imports/registry";
import { ImportCsvForm } from "./ImportCsvForm";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";
// A products import fetches and re-hosts each row's image, which can add
// up over a big file — raises the ceiling Vercel gives the import action as
// far as the hosting plan allows (a Hobby plan caps well below this
// regardless of what's set here, which is the main reason very large
// image-heavy files are better split into a few smaller uploads — see the
// note further down this page). Route segment config like this has to live
// in the page/route file, not in a "use server" actions file.
export const maxDuration = 300;

export default function ImportTypePage({ params }: { params: { type: string } }) {
  const type = getImportType(params.type);
  if (!type) notFound();

  const columns = type.columnsHeader.split(",");

  return (
    <div className="max-w-2xl">
      <Link href="/admin/settings/import" className="text-xs text-stone underline hover:text-ink">
        ← Import data
      </Link>

      <h1 className="font-display text-2xl mt-3 mb-2">Import: {type.label}</h1>
      <p className="mb-6 text-sm text-stone">{type.description}</p>

      <Card className="mb-6 border-line shadow-none">
        <CardContent className="p-5">
          <h3 className="label-caps mb-2">1. Get the template</h3>
          <p className="mb-3 text-sm text-stone">
            Download the template below and fill in one row per {type.key === "products" ? "print" : type.key === "orders" ? "purchase" : "client"}
            , then save it as a CSV (any spreadsheet program can do this from File &gt; Save As / Export). Column order
            doesn't matter, but the column names on the first row need to stay as they are.
          </p>
          <a
            href={`/admin/settings/import/${type.key}/template`}
            className="text-xs text-stone underline hover:text-ink"
          >
            Download template CSV
          </a>
          <div className="mt-4 border-t border-line pt-3">
            <p className="label-caps mb-1 text-stone">Columns</p>
            <ul className="space-y-0.5 text-xs text-stone">
              {columns.map((c) => (
                <li key={c}>
                  <code>{c}</code>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {type.key === "products" && (
        <Card className="mb-6 border-line shadow-none">
          <CardContent className="p-5 text-sm text-stone">
            <p>
              Any <code>image_url</code> you fill in is downloaded and copied into your own image storage
              automatically — the product ends up with its own permanent photo, not just a link to wherever the
              spreadsheet pointed. Any row whose image couldn't be fetched still gets imported, just without a
              photo (add one afterwards from the product's own page).
            </p>
            <p className="mt-2">
              For a big catalogue (e.g. 200+ products with photos), it's safer to upload it as a few smaller files
              — 40-50 rows each — rather than one huge one, since fetching that many images at once can take
              longer than a single upload comfortably allows.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="mb-2">
        <h3 className="label-caps mb-2">2. Upload it</h3>
      </div>
      <ImportCsvForm typeKey={type.key} typeLabel={type.label} />
    </div>
  );
}
