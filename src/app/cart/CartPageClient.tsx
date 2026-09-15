"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useCart, cartLineKey } from "@/lib/cart-context";
import { useCurrency } from "@/lib/currency-context";
import { formatConverted } from "@/lib/currency";
import { getReservationToken } from "@/lib/reservation-token";
import Link from "next/link";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter, type FooterSettings } from "@/components/storefront/SiteFooter";
import type { FooterLinkItem } from "@/lib/footer";
import { COUNTRIES } from "@/lib/countries";
import type { ShippingZoneRow } from "@/lib/shipping";
import { formatCountdown, isCountdownUrgent } from "@/lib/format-countdown";

const inputClass = "border hairline bg-transparent px-3 py-2 text-sm w-full focus:outline-none focus:border-ink";

/** "Edition #13 requested — 4:37" with a live, second-by-second countdown
 * right next to the number — mirroring the picker on the print's own page
 * (AddToCartForm.tsx) — plus a small note underneath, so the hold stays
 * visible (and a little suspenseful) the whole way through checkout rather
 * than a rounded-to-the-minute estimate. Turns red for the last minute,
 * same as the print page. */
function RequestedEditionInfo({
  requestedEditionNumber,
  reservedUntil,
  now,
}: {
  requestedEditionNumber?: number | null;
  reservedUntil?: string | null;
  now: number;
}) {
  if (!requestedEditionNumber) {
    return <p className="label-caps mt-1">Edition auto-assigned at checkout</p>;
  }

  const ms = reservedUntil ? new Date(reservedUntil).getTime() - now : null;
  const expired = ms !== null && ms <= 0;
  const urgent = ms !== null && isCountdownUrgent(ms);

  return (
    <>
      <p className="label-caps mt-1">
        Edition #{requestedEditionNumber} requested
        {ms !== null && !expired && (
          <span className={urgent ? "text-accent" : undefined}> — {formatCountdown(ms)}</span>
        )}
      </p>
      {ms !== null && (
        <p className={expired ? "text-xs text-accent mt-1" : "text-xs text-stone mt-1"}>
          {expired
            ? "Your hold on this number has run out — it may no longer be reserved for you."
            : "Complete checkout before the hold runs out."}
        </p>
      )}
    </>
  );
}

export function CartPageClient({
  zones,
  footer,
}: {
  zones: ShippingZoneRow[];
  footer: { settings: FooterSettings; links: FooterLinkItem[] };
}) {
  const { items, updateQuantity, removeItem, subtotalMinor } = useCart();
  const { currency: displayCurrency, rates, isAuto } = useCurrency();
  const { data: session, status } = useSession();
  const isSignedInCustomer = status === "authenticated" && (session?.user as any)?.role === "CUSTOMER";
  const customerEmail = isSignedInCustomer ? session!.user!.email! : null;

  const [checkoutMode, setCheckoutMode] = useState<"guest" | "signin">("guest");
  const [guestEmail, setGuestEmail] = useState("");
  const [checkingGuestEmail, setCheckingGuestEmail] = useState(false);
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [signinError, setSigninError] = useState<string | null>(null);
  const [signinLoading, setSigninLoading] = useState(false);
  const [emailAlreadyRegisteredNotice, setEmailAlreadyRegisteredNotice] = useState<string | null>(null);

  // Once someone finishes typing their email in guest checkout, quietly
  // check whether it already belongs to a registered account — if so, steer
  // them to sign in instead of letting them place a guest order against an
  // email that isn't provably theirs yet. Best-effort: if the check itself
  // fails, guest checkout just proceeds exactly as it always has.
  async function handleGuestEmailBlur() {
    const email = guestEmail.trim();
    if (!email) return;
    setCheckingGuestEmail(true);
    try {
      const res = await fetch("/api/account/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}) as any);
      if (data?.registered) {
        setSigninEmail(email);
        setEmailAlreadyRegisteredNotice("That email already has an account here — please sign in to continue.");
        setCheckoutMode("signin");
      }
    } catch {
      // ignore — fail open, as above
    } finally {
      setCheckingGuestEmail(false);
    }
  }

  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ticks the per-item countdown below every second — only matters while at
  // least one item actually has a hold on it, but it's cheap enough to just
  // always run, and a second-by-second tick is the whole point (keeps the
  // hold's urgency visible rather than just a rounded estimate).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // The store's most common destinations, pinned to the top of the "Ship
  // to" dropdown in this exact order (Andrew's call, based on where most
  // customers actually ship to) — everything else that ships follows
  // alphabetically underneath.
  const PRIORITY_COUNTRY_CODES = ["GB", "US", "AU", "CA", "FR", "JP", "NL", "DE", "ES", "IE", "IT", "NZ"];

  // Every country the store currently ships to, with its zone's name and
  // price attached — built fresh from the (live, admin-editable) zones
  // rather than any hardcoded list, then sorted with the priority
  // destinations above first, in that fixed order, and the rest
  // alphabetically after them.
  const shippableCountries = useMemo(() => {
    const rows = COUNTRIES.map((c) => {
      const zone = zones.find((z) => z.countryCodes.includes(c.code));
      return zone ? { code: c.code, name: c.name, zoneLabel: zone.label, priceMinor: zone.priceMinor } : null;
    }).filter((r): r is NonNullable<typeof r> => r !== null);

    return rows.sort((a, b) => {
      const aPriority = PRIORITY_COUNTRY_CODES.indexOf(a.code);
      const bPriority = PRIORITY_COUNTRY_CODES.indexOf(b.code);
      if (aPriority !== -1 || bPriority !== -1) {
        // -1 (not in the priority list) should sort after every priority
        // country, not before — treat it as "past the end of the list".
        return (aPriority === -1 ? PRIORITY_COUNTRY_CODES.length : aPriority) -
          (bPriority === -1 ? PRIORITY_COUNTRY_CODES.length : bPriority);
      }
      return a.name.localeCompare(b.name);
    });
  }, [zones]);

  const selectedShipping = shippableCountries.find((c) => c.code === country) ?? null;
  const shippingMinor = selectedShipping?.priceMinor ?? 0;
  const currency = items[0]?.currency ?? "GBP";

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSigninError(null);
    setSigninLoading(true);
    const res = await signIn("customer-credentials", { email: signinEmail, password: signinPassword, redirect: false });
    setSigninLoading(false);
    if (res?.error) {
      setSigninError("Incorrect email or password.");
    }
  }

  async function handleCheckout() {
    setError(null);
    const email = isSignedInCustomer ? customerEmail! : guestEmail;
    if (!isSignedInCustomer && !email) {
      setError("Please enter your email address, or sign in.");
      return;
    }
    if (!country) {
      setError("Please choose where you're shipping to.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: isSignedInCustomer ? undefined : email,
          country,
          token: getReservationToken(),
          items: items.map((i) => ({
            printId: i.printId,
            quantity: i.quantity,
            requestedEditionNumber: i.requestedEditionNumber ?? null,
          })),
        }),
      });

      // The server always tries to send JSON, even on error — but guard
      // against an empty/non-JSON body anyway (e.g. a proxy or dev-server
      // hiccup returning nothing) so this shows a plain message instead of
      // a raw "Unexpected end of JSON input" browser error.
      const raw = await res.text();
      let data: any = {};
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error("The server sent back something unexpected. Please try again in a moment.");
        }
      }
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (!data.url) throw new Error("Checkout didn't return a payment link. Please try again.");
      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex items-baseline justify-between mb-10">
          <h1 className="font-display text-3xl">Your cart</h1>
          <Link href="/" className="label-caps text-stone hover:text-ink">
            ← Continue shopping
          </Link>
        </div>

        {items.length === 0 ? (
          <p className="text-stone">Your cart is empty.</p>
        ) : (
          <div className="space-y-6">
            {items.map((item) => (
              <div
                key={cartLineKey(item.printId, item.requestedEditionNumber)}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 border-b hairline pb-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-16 h-16 object-cover border hairline flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 border hairline flex items-center justify-center text-stone text-[10px] flex-shrink-0">
                      No image
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-display truncate">{item.title}</p>
                    <RequestedEditionInfo
                      requestedEditionNumber={item.requestedEditionNumber}
                      reservedUntil={item.reservedUntil}
                      now={now}
                    />
                  </div>
                </div>
                {/* Stacks below the image/title on narrow screens instead of
                    squeezing into the same row — at phone width there isn't
                    room for image + title + qty + Remove + price all on one
                    line, and forcing it was crushing the title/edition text
                    into an unreadably narrow column. pl-20 lines it up under
                    the title (skipping the image's width) once stacked. */}
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pl-20 sm:pl-0 flex-shrink-0">
                  {item.requestedEditionNumber != null ? (
                    // Only one physical copy exists of any given number, so
                    // there's nothing to adjust here — unlike a "no
                    // preference" line, which can freely be more copies.
                    <span className="w-16 text-sm text-center text-stone">Qty 1</span>
                  ) : (
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.printId, item.requestedEditionNumber, Number(e.target.value))}
                      className="w-16 border hairline bg-transparent px-2 py-1 text-sm text-center"
                    />
                  )}
                  <button
                    onClick={() => removeItem(item.printId, item.requestedEditionNumber)}
                    className="label-caps text-stone hover:text-accent"
                  >
                    Remove
                  </button>
                  <span className="w-24 text-right">
                    {formatConverted(item.priceMinor * item.quantity, item.currency, displayCurrency, rates)}
                  </span>
                </div>
              </div>
            ))}

            <div className="pt-2">
              <label className="label-caps block mb-2">Ship to</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={inputClass + " max-w-sm"}
              >
                <option value="">Select a country…</option>
                {shippableCountries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} — {c.zoneLabel} ({formatConverted(c.priceMinor, "GBP", displayCurrency, rates)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-between pt-2">
              <span>Subtotal</span>
              <span>{formatConverted(subtotalMinor, currency, displayCurrency, rates)}</span>
            </div>
            <div className="flex justify-between text-stone text-sm">
              <span>Shipping{selectedShipping ? ` (${selectedShipping.zoneLabel})` : ""}</span>
              <span>{country ? formatConverted(shippingMinor, "GBP", displayCurrency, rates) : "—"}</span>
            </div>
            <div className="flex justify-between pt-2 text-lg border-t hairline">
              <span>Total</span>
              <span>{formatConverted(subtotalMinor + shippingMinor, currency, displayCurrency, rates)}</span>
            </div>
            {displayCurrency !== currency && (
              <p className="text-xs text-stone">
                Shown in {displayCurrency} for reference{isAuto ? " (based on your location)" : ""} — you'll be
                charged in {currency} at checkout.
              </p>
            )}

            <div className="pt-6 border-t hairline">
              {isSignedInCustomer ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm">
                    Signed in as <strong>{customerEmail}</strong>
                  </p>
                  <button
                    onClick={() => signOut({ redirect: false })}
                    className="label-caps text-stone hover:text-accent"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-6 mb-4 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setCheckoutMode("guest");
                        setEmailAlreadyRegisteredNotice(null);
                      }}
                      className={checkoutMode === "guest" ? "font-display" : "text-stone hover:text-ink"}
                    >
                      Guest checkout
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCheckoutMode("signin");
                        setEmailAlreadyRegisteredNotice(null);
                      }}
                      className={checkoutMode === "signin" ? "font-display" : "text-stone hover:text-ink"}
                    >
                      Sign in
                    </button>
                  </div>

                  {emailAlreadyRegisteredNotice && (
                    <p className="text-sm text-accent mb-4 max-w-sm">{emailAlreadyRegisteredNotice}</p>
                  )}

                  {checkoutMode === "guest" ? (
                    <div>
                      <label className="label-caps block mb-2">Email address</label>
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        onBlur={handleGuestEmailBlur}
                        placeholder="you@example.com"
                        className={inputClass + " max-w-sm"}
                      />
                      {checkingGuestEmail && <p className="text-xs text-stone mt-1">Checking…</p>}
                    </div>
                  ) : (
                    <form onSubmit={handleSignIn} className="max-w-sm space-y-3">
                      <div>
                        <label className="label-caps block mb-2">Email</label>
                        <input
                          type="email"
                          value={signinEmail}
                          onChange={(e) => setSigninEmail(e.target.value)}
                          required
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="label-caps block mb-2">Password</label>
                        <input
                          type="password"
                          value={signinPassword}
                          onChange={(e) => setSigninPassword(e.target.value)}
                          required
                          className={inputClass}
                        />
                      </div>
                      {signinError && <p className="text-sm text-accent">{signinError}</p>}
                      <button type="submit" disabled={signinLoading} className="btn-secondary !px-4 !py-2 disabled:opacity-50">
                        {signinLoading ? "Signing in…" : "Sign in"}
                      </button>
                      <p className="text-xs text-stone">
                        No account yet? <a href="/account/register" className="underline hover:text-ink">Create one</a> — your cart will still be here.
                      </p>
                    </form>
                  )}
                </div>
              )}
            </div>

            {error && <p className="text-sm text-accent">{error}</p>}

            <button onClick={handleCheckout} disabled={loading} className="btn-primary mt-4 disabled:opacity-50">
              {loading ? "Redirecting to Stripe…" : "Checkout with Stripe"}
            </button>
          </div>
        )}
      </section>
      <SiteFooter {...footer} />
    </>
  );
}
