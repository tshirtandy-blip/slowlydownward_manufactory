import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";
import { VisitorTracker } from "@/components/VisitorTracker";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { HeaderSettingsProvider } from "@/lib/header-settings-context";
import { CurrencyProvider } from "@/lib/currency-context";
import { getSiteSettings } from "@/lib/site-settings";
import { getExchangeRates } from "@/lib/currency";
import { detectCurrencyFromRequest } from "@/lib/currency-server";
import { fontStackFor, fontFaceCssFor } from "@/lib/fonts";
import { getCustomFonts } from "@/lib/custom-fonts";
import { CookieConsentPopup } from "@/components/storefront/CookieConsentPopup";

export const metadata: Metadata = {
  title: "Slowly Downward — Limited edition prints by Stanley Donwood",
  description:
    "Limited edition prints by Stanley Donwood. Each work numbered, catalogued, and released in strictly limited quantities.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, rates, customFonts] = await Promise.all([
    getSiteSettings(),
    getExchangeRates(),
    getCustomFonts(),
  ]);
  const detectedCurrency = detectCurrencyFromRequest();

  // The chosen typefaces (Admin > Settings > Typography) are applied as CSS
  // custom properties here, once, server-side — Tailwind's font-display /
  // font-sans utility classes (used throughout the site) resolve through
  // these variables, so no component needs to know settings exist. When a
  // slot is set to an uploaded font, fontStackFor resolves it to that
  // font's own family name — which only means anything once the matching
  // @font-face rule below has told the browser where to fetch it.
  const fontVars = {
    "--font-heading": fontStackFor(settings.headingFont, customFonts),
    "--font-body": fontStackFor(settings.bodyFont, customFonts),
  } as React.CSSProperties;
  const fontFaceCss = fontFaceCssFor(customFonts);

  return (
    <html lang="en" style={fontVars}>
      <body>
        {fontFaceCss && <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} />}
        <AuthSessionProvider>
          <CartProvider>
            <VisitorTracker />
            <HeaderSettingsProvider settings={settings}>
              <CurrencyProvider detectedCurrency={detectedCurrency} rates={rates}>
                {children}
              </CurrencyProvider>
            </HeaderSettingsProvider>
            <CookieConsentPopup
              settings={{
                cookiePopupEnabled: settings.cookiePopupEnabled,
                cookiePopupMessage: settings.cookiePopupMessage,
                cookiePopupSignupHeading: settings.cookiePopupSignupHeading,
                cookiePopupSignupBody: settings.cookiePopupSignupBody,
              }}
            />
          </CartProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
