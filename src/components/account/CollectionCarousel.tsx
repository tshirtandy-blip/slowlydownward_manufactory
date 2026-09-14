"use client";

import { useRef } from "react";
import Link from "next/link";
import type { CollectionPiece } from "@/lib/customer-collection";

export function CollectionCarousel({ pieces }: { pieces: CollectionPiece[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollByCard(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 24 : 320;
    el.scrollBy({ left: step * direction, behavior: "smooth" });
  }

  if (pieces.length === 0) {
    return (
      <div className="border hairline p-10 text-center">
        <p className="text-stone mb-4">Nothing in your collection yet.</p>
        <Link href="/" className="btn-secondary">
          Browse the prints
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pieces.map((piece) => (
          <Link
            key={piece.orderItemId}
            href={`/prints/${piece.printSlug}?view=owned`}
            data-card
            className="group shrink-0 w-64 snap-start"
          >
            <div className="border hairline aspect-[3/4] overflow-hidden bg-line/10 mb-3">
              {piece.printImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={piece.printImageUrl}
                  alt={piece.printTitle}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone text-xs">No image</div>
              )}
            </div>
            <p className="font-display text-lg leading-tight group-hover:text-accent transition-colors">
              {piece.printTitle}
            </p>
            <p className="text-xs text-stone mt-1">
              {piece.editionNumber != null
                ? `Edition #${piece.editionNumber}${piece.editionSize ? ` / ${piece.editionSize}` : ""}`
                : "Open edition"}
            </p>
          </Link>
        ))}
      </div>
      {pieces.length > 1 && (
        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            aria-label="Scroll left"
            className="border hairline w-8 h-8 flex items-center justify-center hover:border-accent hover:text-accent"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            aria-label="Scroll right"
            className="border hairline w-8 h-8 flex items-center justify-center hover:border-accent hover:text-accent"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
