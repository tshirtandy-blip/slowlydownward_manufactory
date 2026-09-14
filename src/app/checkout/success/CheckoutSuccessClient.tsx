"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter, type FooterSettings } from "@/components/storefront/SiteFooter";
import type { FooterLinkItem } from "@/lib/footer";

export function CheckoutSuccessClient({ footer }: { footer: { settings: FooterSettings; links: FooterLinkItem[] } }) {
  const { clear, hydrated } = useCart();

  useEffect(() => {
    // Wait for the cart to finish reading its saved contents back from
    // localStorage before clearing it. This page is reached via a full
    // page reload (Stripe redirecting back), so the cart provider mounts
    // fresh and hydrates from localStorage on this same load — clearing
    // immediately, before that finishes, gets silently overwritten a
    // moment later when hydration restores the pre-checkout cart. This is
    // exactly what caused the basket not to clear after a real checkout.
    if (hydrated) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  return (
    <>
      <SiteHeader />
      <section className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl mb-4">Thank you</h1>
        <p className="text-stone mb-8">
          Your order has been received. You will get a confirmation email shortly, and another once
          it is on its way — with the edition number of the copy you have been sent.
        </p>
        <Link href="/" className="btn-secondary">
          Continue browsing
        </Link>
      </section>
      <SiteFooter {...footer} />
    </>
  );
}
