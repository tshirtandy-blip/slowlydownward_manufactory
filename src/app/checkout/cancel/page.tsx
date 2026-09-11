import Link from "next/link";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";

export default function CheckoutCancelPage() {
  return (
    <>
      <SiteHeader />
      <section className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl mb-4">Checkout cancelled</h1>
        <p className="text-stone mb-8">Your card has not been charged. Your cart is still here.</p>
        <Link href="/cart" className="btn-secondary">
          Back to cart
        </Link>
      </section>
      <SiteFooter />
    </>
  );
}
