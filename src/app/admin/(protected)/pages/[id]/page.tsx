import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseBlocks } from "@/lib/blocks";
import { PageBuilder } from "@/components/admin/PageBuilder";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { SaveButton } from "@/components/admin/SaveButton";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { updatePageMeta, deletePage } from "../actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      <div className="mb-6 flex items-center justify-between">
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
        <div className="border border-line overflow-hidden">
          <SiteHeader />
        </div>
      </div>

      <details className="mb-8 max-w-lg">
        <summary className="label-caps w-fit cursor-pointer">Page settings</summary>
        <Card className="mt-4 border-line shadow-none">
          <CardContent className="p-5">
            <form action={boundMeta} className="space-y-4">
              <div>
                <Label htmlFor="pageTitle" className="label-caps mb-2 block">
                  Title
                </Label>
                <Input id="pageTitle" name="title" defaultValue={page.title} required className="border-line" />
              </div>
              {page.slug !== "home" && (
                <div>
                  <Label htmlFor="pageSlug" className="label-caps mb-2 block">
                    Address
                  </Label>
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-stone">/</span>
                    <Input id="pageSlug" name="slug" defaultValue={page.slug} required className="border-line" />
                  </div>
                </div>
              )}
              {page.slug === "home" ? (
                <p className="text-xs text-stone">The home page is always live — it doesn't have a draft state.</p>
              ) : (
                <div>
                  <Label htmlFor="pageStatus" className="label-caps mb-2 block">
                    Status
                  </Label>
                  <select
                    id="pageStatus"
                    name="status"
                    defaultValue={page.status}
                    className="flex h-10 w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="DRAFT">Draft (only visible to you, signed in)</option>
                    <option value="PUBLISHED">Published</option>
                  </select>
                </div>
              )}
              <SaveButton>Save settings</SaveButton>
            </form>
            {page.slug !== "home" && (
              <form action={boundDelete} className="mt-4 border-t border-line pt-4">
                <ConfirmSubmitButton
                  confirmText={`Delete "${page.title}"? This can't be undone.`}
                  className="text-xs text-stone hover:text-accent"
                >
                  Delete this page
                </ConfirmSubmitButton>
              </form>
            )}
          </CardContent>
        </Card>
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
