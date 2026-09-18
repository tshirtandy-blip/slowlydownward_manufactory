import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseBlocks } from "@/lib/blocks";
import { PageBuilder } from "@/components/admin/PageBuilder";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { SaveButton } from "@/components/admin/SaveButton";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { updatePageMeta, deletePage } from "../actions";

export const dynamic = "force-dynamic";

export default async function PageEditorPage({ params }: { params: { id: string } }) {
  const page = await prisma.page.findUnique({ where: { id: params.id } });
  if (!page) notFound();

  const [prints, collections] = await Promise.all([
    prisma.print.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.collection.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);

  const boundMeta = updatePageMeta.bind(null, page.id);
  const boundDelete = deletePage.bind(null, page.id);
  const viewHref = page.slug === "home" ? "/" : `/${page.slug}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin/pages" className="label-caps text-stone hover:text-ink">
            ← All pages
          </Link>
          <h1 className="font-display text-2xl mt-2">{page.title}</h1>
        </div>
        <Link href={viewHref} target="_blank" className="label-caps text-stone hover:text-ink">
          View page ↗
        </Link>
      </div>

      <div className="mb-8">
        <p className="label-caps mb-2">Preview — your site's actual header</p>
        <div className="border hairline overflow-hidden">
          <SiteHeader />
        </div>
      </div>

      <details className="border hairline p-5 mb-8 max-w-lg">
        <summary className="label-caps cursor-pointer">Page settings</summary>
        <form action={boundMeta} className="space-y-4 mt-4">
          <div>
            <label className="label-caps block mb-2">Title</label>
            <input name="title" defaultValue={page.title} required className="border hairline bg-transparent px-3 py-2 text-sm w-full" />
          </div>
          {page.slug !== "home" && (
            <div>
              <label className="label-caps block mb-2">Address</label>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-stone">/</span>
                <input name="slug" defaultValue={page.slug} required className="border hairline bg-transparent px-3 py-2 text-sm w-full" />
              </div>
            </div>
          )}
          {page.slug === "home" ? (
            <p className="text-xs text-stone">The home page is always live — it doesn't have a draft state.</p>
          ) : (
            <div>
              <label className="label-caps block mb-2">Status</label>
              <select name="status" defaultValue={page.status} className="border hairline bg-transparent px-3 py-2 text-sm w-full">
                <option value="DRAFT">Draft (only visible to you, signed in)</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
          )}
          <SaveButton>Save settings</SaveButton>
        </form>
        {page.slug !== "home" && (
          <form action={boundDelete} className="mt-4 pt-4 border-t hairline">
            <ConfirmSubmitButton
              confirmText={`Delete "${page.title}"? This can't be undone.`}
              className="text-xs text-stone hover:text-accent"
            >
              Delete this page
            </ConfirmSubmitButton>
          </form>
        )}
      </details>

      <PageBuilder
        target={{ kind: "page", id: page.id }}
        initialBlocks={parseBlocks(page.blocks)}
        prints={prints}
        collections={collections}
      />
    </div>
  );
}
