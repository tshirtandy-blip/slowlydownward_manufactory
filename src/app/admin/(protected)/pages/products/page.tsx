import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseBlocks } from "@/lib/blocks";

export const dynamic = "force-dynamic";

export default async function ProductPageContentList() {
  const prints = await prisma.print.findMany({
    orderBy: { title: "asc" },
    select: { id: true, title: true, slug: true, published: true, contentBlocks: true },
  });

  return (
    <div>
      <Link href="/admin/pages" className="label-caps text-stone hover:text-ink">
        ← All pages
      </Link>
      <h1 className="font-display text-2xl mt-2 mb-2">Product page content</h1>
      <p className="text-sm text-stone mb-8 max-w-lg">
        Every print's page already shows its photo, price, and buy box — add extra
        blocks here (more images, a longer story, a quote) to show alongside it.
      </p>

      {prints.length === 0 ? (
        <p className="text-sm text-stone">No prints yet.</p>
      ) : (
        <div className="space-y-2 max-w-lg">
          {prints.map((print) => {
            const count = parseBlocks(print.contentBlocks).length;
            return (
              <Link
                key={print.id}
                href={`/admin/pages/products/${print.id}`}
                className="border hairline p-4 flex items-center justify-between hover:border-ink"
              >
                <span>
                  {print.title} <span className="text-stone text-sm">/{print.slug}</span>
                </span>
                <span className="label-caps text-stone">
                  {count} extra block{count === 1 ? "" : "s"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
