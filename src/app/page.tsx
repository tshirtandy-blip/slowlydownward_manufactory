import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { PrintCard } from "@/components/storefront/PrintCard";

export const dynamic = "force-dynamic";

async function getPrints() {
  const prints = await prisma.print.findMany({
    where: { published: true },
    include: { editions: { where: { status: "AVAILABLE" }, select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });
  return prints;
}

export default async function HomePage() {
  const prints = await getPrints();

  return (
    <>
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
        <p className="label-caps mb-6">Stanley Donwood — Limited Editions</p>
        <h1 className="font-display text-4xl md:text-6xl leading-tight max-w-3xl mx-auto">
          Prints made slowly, released rarely, gone for good.
        </h1>
        <p className="mt-6 text-stone max-w-xl mx-auto">
          Every print is hand-numbered from a strictly limited edition. When
          the edition sells out, it is not reprinted.
        </p>
      </section>

      <section id="prints" className="mx-auto max-w-6xl px-6 pb-24">
        {prints.length === 0 ? (
          <p className="text-center text-stone py-24">
            No prints are currently listed. Check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
            {prints.map((print) => (
              <PrintCard
                key={print.id}
                slug={print.slug}
                title={print.title}
                priceMinor={print.priceMinor}
                currency={print.currency}
                imageUrl={print.primaryImageUrl}
                availableCount={print.editions.length}
                editionSize={print.editionSize}
              />
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </>
  );
}
