"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter, type FooterSettings } from "@/components/storefront/SiteFooter";
import type { FooterLinkItem } from "@/lib/footer";

const inputClass = "border hairline bg-transparent px-3 py-2 text-sm w-full";

export function LoginClient({ footer }: { footer: { settings: FooterSettings; links: FooterLinkItem[] } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("customer-credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Incorrect email or password.");
      return;
    }
    router.push(searchParams.get("from") || "/account");
    router.refresh();
  }

  return (
    <>
      <SiteHeader />
      <section className="mx-auto max-w-sm px-6 py-16">
        <h1 className="font-display text-3xl mb-8">Sign in</h1>
        <form onSubmit={handleSubmit}>
          <label className="label-caps block mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass + " mb-4"}
          />
          <label className="label-caps block mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputClass + " mb-6"}
          />
          {error && <p className="text-sm text-accent mb-4">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-sm text-stone mt-6">
          New here? <Link href="/account/register" className="underline hover:text-ink">Create an account</Link>
        </p>
      </section>
      <SiteFooter {...footer} />
    </>
  );
}
