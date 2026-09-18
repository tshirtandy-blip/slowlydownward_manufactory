import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import type { FooterSettings } from "@/components/storefront/SiteFooter";

/** One link in the footer's "Information" column, resolved to the page it
 * opens — see the FooterLink model. Fetched alongside site settings by
 * every page that renders <SiteFooter>. */
export type FooterLinkItem = { id: string; label: string; slug: string };

export async function getFooterLinks(): Promise<FooterLinkItem[]> {
  try {
    const links = await prisma.footerLink.findMany({
      orderBy: { sortOrder: "asc" },
      include: { page: { select: { slug: true } } },
    });
    return links.map((l) => ({ id: l.id, label: l.label, slug: l.page.slug }));
  } catch {
    // Database unreachable, or this migration hasn't run yet — an empty
    // links list just means the "Information" column has nothing to show,
    // rather than crashing the whole page.
    return [];
  }
}

// One Instagram/Facebook/whatever-platform link, shown bottom-left in the
// footer (same column as the "The Archive" blurb) — see SocialLink model
// and Admin > Settings > Footer.
export type SocialLinkItem = { id: string; platform: string; url: string };

export async function getSocialLinks(): Promise<SocialLinkItem[]> {
  try {
    const links = await prisma.socialLink.findMany({ orderBy: { sortOrder: "asc" } });
    return links.map((l) => ({ id: l.id, platform: l.platform, url: l.url }));
  } catch {
    // Database unreachable, or this migration hasn't run yet.
    return [];
  }
}

/** Everything <SiteFooter> needs, fetched together — the one call every
 * page that renders the footer makes (see SiteFooter.tsx's own comment for
 * why it takes props instead of fetching this itself). */
export async function getFooterProps(): Promise<{
  settings: FooterSettings;
  links: FooterLinkItem[];
  socialLinks: SocialLinkItem[];
}> {
  const [siteSettings, links, socialLinks] = await Promise.all([getSiteSettings(), getFooterLinks(), getSocialLinks()]);
  const {
    footerColumn1Heading,
    footerColumn1Body,
    footerColumn2Heading,
    footerColumn2Body,
    footerLinksHeading,
    footerCopyrightName,
    footerBadgeText,
  } = siteSettings;
  return {
    settings: {
      footerColumn1Heading,
      footerColumn1Body,
      footerColumn2Heading,
      footerColumn2Body,
      footerLinksHeading,
      footerCopyrightName,
      footerBadgeText,
    },
    links,
    socialLinks,
  };
}
