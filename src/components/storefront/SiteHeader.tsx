"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { useCurrency } from "@/lib/currency-context";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { useHeaderSettings, type HeaderSettings } from "@/lib/header-settings-context";

/** How far from the very top of the page the header sits, even while it's
 * stuck to the top during scrolling — the gap of page background Andrew
 * asked to add above it so it doesn't feel like it's crammed against the
 * edge of the browser window. */
const HEADER_TOP_OFFSET = "5mm";

/** "Smart" sticky behaviour: the header sticks to the top of the window,
 * hides itself out of the way on the way down the page, and reappears the
 * moment you scroll back up — rather than simply staying on screen the
 * whole time (which would permanently cover content on a long page). */
function useSmartStickyHeader() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;

    function handleScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        // Always show it near the top of the page — only start hiding it
        // once you've scrolled far enough that the header itself would
        // otherwise be covering content rather than sitting above it.
        if (y < 80) {
          setHidden(false);
        } else if (y > lastY.current) {
          setHidden(true); // scrolling down
        } else if (y < lastY.current) {
          setHidden(false); // scrolling up
        }
        lastY.current = y;
        ticking.current = false;
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return hidden;
}

function Logo({ settings }: { settings: HeaderSettings }) {
  if (settings.logoType === "NONE") return null;

  // 100% = the site's normal logo size (a 40px-tall image, or a 1.5rem
  // wordmark) — the admin +/- control scales up or down from there.
  const scale = (settings.logoScale || 100) / 100;

  if (settings.logoType === "IMAGE" && settings.logoImageUrl) {
    return (
      <Link href="/" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={settings.logoImageUrl}
          alt={settings.logoText || "Home"}
          className="w-auto h-auto object-contain"
          style={{ maxHeight: `${40 * scale}px`, maxWidth: "100%" }}
        />
      </Link>
    );
  }

  return (
    <Link
      href="/"
      className="font-display tracking-wide whitespace-nowrap"
      style={{ fontSize: `${1.5 * scale}rem` }}
    >
      {settings.logoText || "Slowly Downward"}
    </Link>
  );
}

function CurrencySelector() {
  const { currency, isAuto, setCurrency } = useCurrency();
  return (
    <select
      value={isAuto ? "AUTO" : currency}
      onChange={(e) => setCurrency(e.target.value)}
      aria-label="Currency"
      // appearance-none strips the browser's own dropdown arrow — with no
      // border or background here (just plain text floating in the
      // header bar) that native arrow rendered as a stray mark next to
      // the logo rather than looking like part of a control. Hidden
      // below the sm breakpoint entirely — on a phone the header has too
      // little room either way, so it's automatic-by-IP-detection only
      // there (see detectCurrencyFromRequest / CurrencyProvider — that
      // detection isn't affected by this control's visibility at all,
      // it always runs). A VPN'd visitor on their phone just gets
      // whatever currency their apparent location resolves to, same as
      // anyone who never touches this dropdown on desktop either.
      className="hidden sm:inline-block label-caps bg-transparent border-none appearance-none cursor-pointer hover:text-ink focus:outline-none"
      style={{ WebkitAppearance: "none", MozAppearance: "none" }}
    >
      <option value="AUTO">Auto ({currency})</option>
      {SUPPORTED_CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

function AccountIcon({ customUrl }: { customUrl: string | null }) {
  return (
    <Link href="/account" aria-label="Account" className="hover:text-ink flex items-center">
      {customUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={customUrl} alt="Account" className="w-5 h-5 object-contain" />
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 20c1.5-4 4.5-6 7.5-6s6 2 7.5 6" strokeLinecap="round" />
        </svg>
      )}
    </Link>
  );
}

function CartIcon({ customUrl, count }: { customUrl: string | null; count: number }) {
  return (
    <Link href="/cart" aria-label="Cart" className="relative hover:text-ink flex items-center">
      {customUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={customUrl} alt="Cart" className="w-5 h-5 object-contain" />
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path
            d="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-1.7 5.1A1 1 0 0 0 6.3 19H17"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="21" r="1" />
          <circle cx="17" cy="21" r="1" />
        </svg>
      )}
      {count > 0 && (
        <span className="absolute -top-2 -right-2 bg-ink text-paper text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
          {count}
        </span>
      )}
    </Link>
  );
}

export function SiteHeader() {
  const { count } = useCart();
  const settings = useHeaderSettings();
  const hidden = useSmartStickyHeader();

  return (
    <header
      className="sticky z-40 bg-paper transition-transform duration-300 ease-out"
      style={{ top: HEADER_TOP_OFFSET, transform: hidden ? "translateY(-100%)" : "translateY(0)" }}
    >
      {/* Three equal-width columns rather than the logo being absolutely
          positioned over the row: an oversized logo (the admin logo-size
          control goes up to 300%) then still pushes the header's own height
          out to fit it, instead of silently overflowing past the header's
          edges — which is exactly what let a scaled-up centred logo poke
          out from underneath the "hidden" state of the sticky header above,
          since translating the header up by its own (too-short) height
          didn't clear content that had been hanging outside that height. */}
      <div className="mx-auto max-w-6xl px-6 py-9 grid grid-cols-3 items-center">
        {/* The currency selector lives in this left-hand column regardless
            of where the logo is positioned, so it always sits flush with
            the left edge — the same distance in as the cart icon is from
            the right edge — instead of getting pulled in next to a
            centred or right-aligned logo. */}
        <div className="flex items-center gap-4">
          {settings.logoPosition === "LEFT" && <Logo settings={settings} />}
          {settings.showCurrencySelector && <CurrencySelector />}
        </div>

        <div className="flex items-center justify-center">
          {settings.logoPosition === "CENTER" && <Logo settings={settings} />}
        </div>

        <div className="flex items-center justify-end gap-6">
          {settings.logoPosition === "RIGHT" && <Logo settings={settings} />}
          {settings.showAccountIcon && <AccountIcon customUrl={settings.accountIconUrl} />}
          {settings.showCartIcon && <CartIcon customUrl={settings.cartIconUrl} count={count} />}
        </div>
      </div>
    </header>
  );
}
