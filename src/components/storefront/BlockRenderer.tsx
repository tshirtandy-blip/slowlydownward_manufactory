import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PrintCard } from "@/components/storefront/PrintCard";
import { RichOrPlainBody } from "@/components/storefront/RichOrPlainBody";
import type { Block, PrintGridBlock } from "@/lib/blocks";

const editionsInclude = {
  editions: { where: { status: "AVAILABLE" as const }, select: { id: true } },
};

async function resolvePrintGrid(block: PrintGridBlock) {
  if (block.mode === "selected") {
    const ids = block.printIds ?? [];
    if (ids.length === 0) return [];
    const prints = await prisma.print.findMany({
      where: { id: { in: ids }, published: true },
      include: editionsInclude,
    });
    const byId = new Map(prints.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  }

  if (block.mode === "collection" && block.collectionId) {
    return prisma.print.findMany({
      where: { collectionId: block.collectionId, published: true },
      include: editionsInclude,
      orderBy: { createdAt: "desc" },
      take: block.limit || undefined,
    });
  }

  return prisma.print.findMany({
    where: { published: true },
    include: editionsInclude,
    orderBy: { createdAt: "desc" },
    take: block.limit || undefined,
  });
}


/** Renders an ordered list of content blocks — used for the home page,
 * standalone pages, and the extra content on a print's page. Async because
 * a printGrid block needs to look its prints up. */
export async function BlockRenderer({ blocks }: { blocks: Block[] }) {
  const rendered = await Promise.all(blocks.map((block) => renderBlock(block)));
  return <>{rendered}</>;
}

async function renderBlock(block: Block) {
  switch (block.type) {
    case "hero":
      return (
        <section key={block.id} className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
          {block.eyebrow && <p className="label-caps mb-6">{block.eyebrow}</p>}
          <h1 className="font-display text-4xl md:text-6xl leading-tight max-w-3xl mx-auto">
            {block.heading}
          </h1>
          {block.subheading && (
            <p className="mt-6 text-stone max-w-xl mx-auto">{block.subheading}</p>
          )}
          {block.imageUrl && (
            <div className="relative mt-12 aspect-[16/7] max-w-4xl mx-auto bg-white border hairline">
              <Image src={block.imageUrl} alt="" fill sizes="100vw" className="object-cover" />
            </div>
          )}
        </section>
      );

    case "text":
      return (
        <section key={block.id} className="mx-auto max-w-2xl px-6 py-10">
          <RichOrPlainBody body={block.body} />
        </section>
      );

    case "image":
      if (!block.imageUrl) return null;
      return (
        <section
          key={block.id}
          className={`mx-auto px-6 py-8 ${
            block.width === "full" ? "" : block.width === "wide" ? "max-w-6xl" : "max-w-2xl"
          }`}
        >
          <div className="relative aspect-[16/9] bg-white border hairline">
            <Image src={block.imageUrl} alt={block.caption ?? ""} fill sizes="100vw" className="object-cover" />
          </div>
          {block.caption && <p className="label-caps mt-3 text-center">{block.caption}</p>}
        </section>
      );

    case "imageText":
      return (
        <section
          key={block.id}
          className="mx-auto max-w-6xl px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-12 items-center"
        >
          <div className={block.imagePosition === "right" ? "md:order-2" : ""}>
            <div className="relative aspect-[4/5] bg-white border hairline">
              {block.imageUrl ? (
                <Image src={block.imageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone">No image</div>
              )}
            </div>
          </div>
          <div>
            {block.heading && <h2 className="font-display text-2xl mb-4">{block.heading}</h2>}
            <RichOrPlainBody body={block.body} />
          </div>
        </section>
      );

    case "gallery": {
      const images = block.images.filter((img) => img.url);
      if (images.length === 0) return null;
      return (
        <section key={block.id} className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((img, i) => (
              <div key={i}>
                <div className="relative aspect-square bg-white border hairline">
                  <Image src={img.url} alt={img.caption ?? ""} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" />
                </div>
                {img.caption && <p className="text-xs text-stone mt-2">{img.caption}</p>}
              </div>
            ))}
          </div>
        </section>
      );
    }

    case "quote":
      return (
        <section key={block.id} className="mx-auto max-w-2xl px-6 py-16 text-center">
          <p className="font-display text-2xl md:text-3xl leading-snug">&ldquo;{block.text}&rdquo;</p>
          {block.attribution && <p className="label-caps mt-6">{block.attribution}</p>}
        </section>
      );

    case "button":
      return (
        <section key={block.id} className="mx-auto max-w-2xl px-6 py-8 text-center">
          <Link href={block.href} className="btn-primary">
            {block.label}
          </Link>
        </section>
      );

    case "spacer": {
      const height = block.size === "lg" ? "h-32" : block.size === "sm" ? "h-8" : "h-16";
      return <div key={block.id} className={height} />;
    }

    case "printGrid": {
      const prints = await resolvePrintGrid(block);
      // With only one or two prints, a left-aligned 3-column grid leaves them
      // stranded in a corner — center them instead, at a width that keeps
      // card size consistent with the full grid.
      const gridClass =
        prints.length === 1
          ? "max-w-xs mx-auto"
          : prints.length === 2
          ? "grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-14 max-w-2xl mx-auto"
          : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14";
      return (
        <section key={block.id} id="prints" className="mx-auto max-w-6xl px-6 py-12">
          {block.heading && <h2 className="font-display text-2xl mb-10 text-center">{block.heading}</h2>}
          {prints.length === 0 ? (
            <p className="text-center text-stone py-24">No prints to show yet.</p>
          ) : (
            <div className={gridClass}>
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
      );
    }

    default:
      return null;
  }
}
