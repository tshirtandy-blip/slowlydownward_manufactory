import Link from "next/link";
import { editionSummary } from "@/lib/editions";
import { PriceTag } from "@/components/storefront/PriceTag";

export function PrintCard({
  slug,
  title,
  priceMinor,
  currency,
  imageUrl,
  availableCount,
  editionSize,
}: {
  slug: string;
  title: string;
  priceMinor: number;
  currency: string;
  imageUrl?: string | null;
  availableCount: number;
  editionSize: number | null;
}) {
  return (
    <Link href={`/prints/${slug}`} className="group block">
      <div className="relative overflow-hidden border hairline">
        {imageUrl ? (
          // Plain <img>, not next/image: uploads don't carry stored
          // width/height, and next/image needs one of those (or a
          // fixed-size "fill" parent) to render — which is exactly what
          // caused the letterboxed space around scaled-to-fit images.
          // A plain <img> lets this container hug the image's own
          // scaled height instead.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="aspect-[4/5] flex items-center justify-center text-stone text-sm">
            No image
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <h3 className="font-display text-base">{title}</h3>
        <PriceTag priceMinor={priceMinor} currency={currency} className="text-sm" />
      </div>
      <p className="label-caps mt-1">{editionSummary(availableCount, editionSize)}</p>
    </Link>
  );
}
