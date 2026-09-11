import Link from "next/link";
import Image from "next/image";
import { formatMinor } from "@/lib/money";
import { editionSummary } from "@/lib/editions";

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
  editionSize: number;
}) {
  const soldOut = availableCount === 0;

  return (
    <Link href={`/prints/${slug}`} className="group block">
      <div className="relative aspect-[4/5] bg-white overflow-hidden border hairline">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone text-sm">
            No image
          </div>
        )}
        {soldOut && (
          <div className="absolute top-3 left-3 bg-paper px-2 py-1 text-[10px] uppercase tracking-widest2">
            Sold out
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <h3 className="font-display text-base">{title}</h3>
        <span className="text-sm">{formatMinor(priceMinor, currency)}</span>
      </div>
      <p className="label-caps mt-1">{editionSummary(availableCount, editionSize)}</p>
    </Link>
  );
}
