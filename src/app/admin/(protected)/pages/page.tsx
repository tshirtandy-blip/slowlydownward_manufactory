import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseBlocks } from "@/lib/blocks";
import { createPage } from "./actions";

export const dynamic = "force-dynamic";

export default async function PagesListPage() {
  const pages = await prisma.page.findMany({ orderBy: [{ slug: "asc" }] });
  const home = pages.find((p) => p.slug === "home");
  const others = pages.filter((p) => p.slug !== "home");

  return (
    <div>
      <h1 className="font-display text-2xl mb-2">Pages</h1>
      <p className="text-sm text-stone mb-8 max-w-lg">
        Build and edit the storefront's pages here — no code required. Add,
        remove, and drag blocks to reorder them, then hit Save changes.
      </p>

      <div className="mb-10">
        <h2 className="label-caps mb-3">Home page</h2>
        {home ? (
          <Link
            href={`/admin/pages/${home.id}`}
            className="border hairline p-4 flex items-center justify-between hover:border-ink block max-w-lg"
          >
            <span>Home</span>
            <span className="label-caps text-stone">{parseBlocks(home.blocks).length} blocks</span>
          </Link>
        ) : (
          <p className="text-sm text-stone max-w-lg">
            No home page record yet — run <code>npm run seed</code> to create one, or add a page
            below with the address <code>home</code>.
          </p>
        )}
      </div>

      <div className="mb-10">
        <div className="flex items-center justify-between mb-3 max-w-lg">
          <h2 className="label-caps">Other pages</h2>
          <Link href="/admin/pages/products" className="text-xs label-caps text-stone hover:text-ink">
            Edit product page content →
          </Link>
        </div>

        {others.length === 0 ? (
          <p className="text-sm text-stone mb-6">No other pages yet — create your first one below.</p>
        ) : (
          <div className="space-y-2 max-w-lg mb-6">
            {others.map((page) => (
              <Link
                key={page.id}
                href={`/admin/pages/${page.id}`}
                className="border hairline p-4 flex items-center justify-between hover:border-ink"
              >
                <span>
                  {page.title} <span className="text-stone text-sm">/{page.slug}</span>
                </span>
                <span className="label-caps text-stone">{page.status === "PUBLISHED" ? "Published" : "Draft"}</span>
              </Link>
            ))}
          </div>
        )}

        <form action={createPage} className="border hairline p-6 max-w-lg space-y-4">
          <h3 className="label-caps">New page</h3>
          <div>
            <label className="label-caps block mb-2">Title</label>
            <input name="title" required className="border hairline bg-transparent px-3 py-2 text-sm w-full" />
          </div>
          <div>
            <label className="label-caps block mb-2">Address (optional — e.g. about, faq)</label>
            <input name="slug" placeholder="leave blank to use the title" className="border hairline bg-transparent px-3 py-2 text-sm w-full" />
          </div>
          <button type="submit" className="btn-primary">
            Create page
          </button>
        </form>
      </div>
    </div>
  );
}
