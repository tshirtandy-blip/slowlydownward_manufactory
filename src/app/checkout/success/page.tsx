"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";

export default function CheckoutSuccessPage() {
  const { clear } = useCart();

  useEffect(() => {
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <SiteFooter />
    </>
  );
}
