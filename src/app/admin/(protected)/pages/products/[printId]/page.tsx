import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseBlocks } from "@/lib/blocks";
import { PageBuilder } from "@/components/admin/PageBuilder";
import { SiteHeader } from "@/components/storefront/SiteHeader";

export const dynamic = "force-dynamic";

export default async function ProductContentEditorPage({ params }: { params: { printId: string } }) {
  const print = await prisma.print.findUnique({ where: { id: params.printId } });
  if (!print) notFound();

  const [prints, collections] = await Promise.all([
    prisma.print.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.collection.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin/pages/products" className="label-caps text-stone hover:text-ink">
            ← Product page content
          </Link>
          <h1 className="font-display text-2xl mt-2">{print.title}</h1>
        </div>
        <Link href={`/prints/${print.slug}`} target="_blank" className="label-caps text-stone hover:text-ink">
          View page ↗
        </Link>
      </div>

      <p className="mb-8 max-w-lg text-sm text-stone">
        These blocks appear below the photo and buy box on this print's page. The
        core details (image, price, technique, dimensions) are edited from Stock,
        not here.
      </p>

      <div className="mb-8">
        <p className="label-caps mb-2">Preview — your site's actual header</p>
        <div className="border border-line overflow-hidden">
          <SiteHeader />
        </div>
      </div>

      <PageBuilder
        target={{ kind: "print", id: print.id }}
        initialBlocks={parseBlocks(print.contentBlocks)}
        prints={prints}
        collections={collections}
      />
    </div>
  );
}
