"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";

export function SiteHeader() {
  const { count } = useCart();

  return (
    <header className="border-b hairline">
      <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <Link href="/" className="font-display text-xl md:text-2xl tracking-wide">
          Slowly Downward
        </Link>
        <nav className="flex items-center gap-8 label-caps">
          <Link href="/#prints" className="hover:text-ink">
            Prints
          </Link>
          <Link href="/#archive" className="hover:text-ink">
            The Archive
          </Link>
          <Link href="/cart" className="hover:text-ink">
            Cart{count > 0 ? ` (${count})` : ""}
          </Link>
        </nav>
      </div>
    </header>
  );
}
