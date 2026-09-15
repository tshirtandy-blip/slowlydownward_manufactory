import { prisma } from "@/lib/prisma";

// SiteSettings is a singleton — there's only ever meant to be one row,
// always fetched/created under this same fixed id so there's no ambiguity
// about which row "the" settings are.
export const SITE_SETTINGS_ID = "singleton";

const DEFAULTS = {
  logoType: "TEXT" as const,
  logoText: "Slowly Downward",
  logoImageUrl: null as string | null,
  logoPosition: "LEFT" as const,
  logoScale: 100,
  showCartIcon: true,
  cartIconUrl: null as string | null,
  showAccountIcon: true,
  accountIconUrl: null as string | null,
  showCurrencySelector: true,
  headingFont: "serif-times",
  bodyFont: "sans-helvetica",
  footerColumn1Heading: "The Archive",
  footerColumn1Body:
    "Limited edition prints by Stanley Donwood. Each work is numbered, catalogued, and released in strictly limited quantities. Once an edition is gone, it is gone.",
  footerColumn2Heading: "Excuse Me",
  footerColumn2Body: "Sign up to hear about new releases before they go public.",
  footerLinksHeading: "Information",
  footerCopyrightName: "Slowly Downward",
  footerBadgeText: "Stripe secure checkout",
  editionReservationMinutes: 5,
  editionPickerNote:
    "Choosing a number holds it for you for a short time — complete checkout before it runs out, or it's released back to general availability.",
  emailLogoUrl: null as string | null,
  cookiePopupEnabled: true,
  cookiePopupMessage:
    "We use a few essential cookies to keep the site and your basket working. Nothing beyond that.",
  cookiePopupSignupHeading: "Hear about new releases",
  cookiePopupSignupBody:
    "Leave your email if you'd like to know when a new print goes live, before it's announced anywhere else.",
  withdrawalPeriodDays: 14,
};

export async function getSiteSettings() {
  try {
    return await prisma.siteSettings.upsert({
      where: { id: SITE_SETTINGS_ID },
      update: {},
      create: { id: SITE_SETTINGS_ID, ...DEFAULTS },
    });
  } catch {
    // Database unreachable, or this migration hasn't been run yet — fall
    // back to defaults so the storefront still renders instead of crashing.
    return { id: SITE_SETTINGS_ID, ...DEFAULTS, updatedAt: new Date() };
  }
}
