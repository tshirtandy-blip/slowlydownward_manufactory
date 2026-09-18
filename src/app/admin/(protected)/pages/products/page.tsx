import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseBlocks } from "@/lib/blocks";
import { Card, CardContent } from "@/components/ui/card";

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
      <p className="mb-8 max-w-lg text-sm text-stone">
        Every print's page already shows its photo, price, and buy box — add extra
        blocks here (more images, a longer story, a quote) to show alongside it.
      </p>

      {prints.length === 0 ? (
        <p className="text-sm text-stone">No prints yet.</p>
      ) : (
        <div className="max-w-lg space-y-2">
          {prints.map((print) => {
            const count = parseBlocks(print.contentBlocks).length;
            return (
              <Link key={print.id} href={`/admin/pages/products/${print.id}`} className="block">
                <Card className="border-line shadow-none transition-colors hover:border-ink">
                  <CardContent className="flex items-center justify-between p-4">
                    <span>
                      {print.title} <span className="text-sm text-stone">/{print.slug}</span>
                    </span>
                    <span className="label-caps text-stone">
                      {count} extra block{count === 1 ? "" : "s"}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
