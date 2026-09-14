import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { getFooterProps } from "@/lib/footer";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  const customer = session?.user && (session.user as any).role === "CUSTOMER" ? session.user : null;
  const footer = await getFooterProps();

  return (
    <>
      <SiteHeader />
      <section className="mx-auto max-w-xl px-6 py-24 text-center">
        {customer ? (
          <>
            <h1 className="font-display text-3xl mb-2">Welcome back</h1>
            <p className="text-stone mb-8">Signed in as {customer.email}</p>
            <p className="text-sm text-stone mb-8">
              Your collection will appear here soon — for now, contact us directly about an existing order.
            </p>
            <SignOutButton />
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl mb-4">Your account</h1>
            <p className="text-stone mb-8">
              Sign in to see your details next time you check out, or continue shopping as a guest — no account
              needed.
            </p>
            <div className="flex items-center justify-center gap-6">
              <Link href="/account/login" className="btn-primary">
                Sign in
              </Link>
              <Link href="/account/register" className="btn-secondary">
                Create an account
              </Link>
            </div>
          </>
        )}
      </section>
      <SiteFooter {...footer} />
    </>
  );
}
