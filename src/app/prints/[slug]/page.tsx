import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { customerOwnsPrint } from "@/lib/customer-collection";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { getFooterProps } from "@/lib/footer";
import { BlockRenderer } from "@/components/storefront/BlockRenderer";
import { RichOrPlainBody } from "@/components/storefront/RichOrPlainBody";
import { PriceTag } from "@/components/storefront/PriceTag";
import { editionSummary } from "@/lib/editions";
import { releaseExpiredReservations } from "@/lib/edition-reservations";
import { getSiteSettings } from "@/lib/site-settings";
import { parseBlocks } from "@/lib/blocks";
import { AddToCartForm } from "@/components/storefront/AddToCartForm";

export const dynamic = "force-dynamic";

async function getPrint(slug: string) {
  return prisma.print.findUnique({ where: { slug } });
}

export default async function PrintPage({ params }: { params: { slug: string } }) {
  const print = await getPrint(params.slug);
  if (!print) notFound();
  if (!print.published) {
    // Unpublished usually means sold out / taken off the shop — but a past
    // buyer's "My Collection" link (src/app/account/page.tsx) should never
    // lead to a dead page, so let someone who actually owns a paid copy
    // keep viewing it.
    const session = await getServerSession(authOptions);
    const customerSession = session?.user && (session.user as any).role === "CUSTOMER" ? session.user : null;
    const owns = customerSession ? await customerOwnsPrint((customerSession as any).id, print.id) : false;
    if (!owns) notFound();
  }

  // A reservation that's simply timed out shouldn't still count as "taken"
  // the next time someone loads this page — see src/lib/edition-reservations.ts.
  if (print.editionSize !== null) {
    await releaseExpiredReservations(prisma, print.id);
  }
  const availableEditions =
    print.editionSize !== null
      ? await prisma.edition.findMany({
          where: { printId: print.id, status: "AVAILABLE" },
          select: { number: true },
          orderBy: { number: "asc" },
        })
      : [];
  const availableNumbers = availableEditions.map((e) => e.number);

  const settings = await getSiteSettings();
  const footer = await getFooterProps();

  return (
    <>
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="relative border hairline">
          {print.primaryImageUrl ? (
            // Plain <img>, not next/image — see PrintCard.tsx for why: this
            // lets the container hug the image's own scaled height rather
            // than boxing it into a fixed aspect ratio with space around it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={print.primaryImageUrl} alt={print.title} className="w-full h-auto block" />
          ) : (
            <div className="aspect-[4/5] flex items-center justify-center text-stone">No image</div>
          )}
        </div>

        <div>
          <p className="label-caps mb-2">{print.artist}</p>
          <h1 className="font-display text-3xl md:text-4xl mb-4">{print.title}</h1>
          <PriceTag priceMinor={print.priceMinor} currency={print.currency} className="text-lg mb-1 block" />
          <p className="label-caps mb-6">
            {editionSummary(availableNumbers.length, print.editionSize)}
          </p>

          {print.description && (
            <div className="mb-6">
              <RichOrPlainBody body={print.description} />
            </div>
          )}

          <dl className="text-sm text-stone mb-8 space-y-1">
            {print.technique && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0">Technique</dt>
                <dd>{print.technique}</dd>
              </div>
            )}
            {print.paperSize && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0">Paper size</dt>
                <dd>{print.paperSize}</dd>
              </div>
            )}
            {print.imageSize && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0">Print size</dt>
                <dd>{print.imageSize}</dd>
              </div>
            )}
            {print.year && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0">Year</dt>
                <dd>{print.year}</dd>
              </div>
            )}
          </dl>

          <AddToCartForm
            printId={print.id}
            slug={print.slug}
            title={print.title}
            priceMinor={print.priceMinor}
            currency={print.currency}
            imageUrl={print.primaryImageUrl ?? undefined}
            availableNumbers={availableNumbers}
            editionSize={print.editionSize}
            pickerNote={settings.editionPickerNote}
          />
        </div>
      </section>

      <BlockRenderer blocks={parseBlocks(print.contentBlocks)} />

      <SiteFooter {...footer} />
    </>
  );
}
