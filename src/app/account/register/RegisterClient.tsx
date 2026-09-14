"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter, type FooterSettings } from "@/components/storefront/SiteFooter";
import type { FooterLinkItem } from "@/lib/footer";

const inputClass = "border hairline bg-transparent px-3 py-2 text-sm w-full";

export function RegisterClient({ footer }: { footer: { settings: FooterSettings; links: FooterLinkItem[] } }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/account/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");

      // Registered — sign them straight in rather than making them log in
      // again with what they just typed.
      const signInRes = await signIn("customer-credentials", { email, password, redirect: false });
      if (signInRes?.error) {
        router.push("/account/login");
        return;
      }
      router.push("/account");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <section className="mx-auto max-w-sm px-6 py-16">
        <h1 className="font-display text-3xl mb-8">Create an account</h1>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="label-caps block mb-2">First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="label-caps block mb-2">Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            </div>
          </div>
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
            minLength={8}
            className={inputClass + " mb-4"}
          />
          <label className="label-caps block mb-2">Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className={inputClass + " mb-6"}
          />
          {error && <p className="text-sm text-accent mb-4">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="text-sm text-stone mt-6">
          Already have an account? <Link href="/account/login" className="underline hover:text-ink">Sign in</Link>
        </p>
      </section>
      <SiteFooter {...footer} />
    </>
  );
}
