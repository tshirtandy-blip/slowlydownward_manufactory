import Link from "next/link";
import type { FooterLinkItem } from "@/lib/footer";
import { NewsletterSignupForm } from "@/components/storefront/NewsletterSignupForm";

export type FooterSettings = {
  footerColumn1Heading: string;
  footerColumn1Body: string;
  footerColumn2Heading: string;
  footerColumn2Body: string;
  footerLinksHeading: string;
  footerCopyrightName: string;
  footerBadgeText: string;
};

// A plain, props-driven component (no data fetching of its own) so it can
// be rendered from either a Server Component page (the usual case — fetch
// with getSiteSettings() + getFooterLinks() and pass the results in) or
// from inside a "use client" page like the cart, which gets these same
// values passed down from its own server-rendered parent instead. Every
// piece of text here is editable from Admin > Settings > Footer.
export function SiteFooter({ settings, links }: { settings: FooterSettings; links: FooterLinkItem[] }) {
  // A light buffer on top of whatever bottom padding the page's own last
  // section already has (every content block already ends with its own
  // py-8 to py-16) — this used to be mt-24 on top of that, which is what
  // made the gap above the footer look far bigger than the gaps between
  // any other two sections on the page.
  return (
    <footer id="archive" className="mt-8">
      <div className="mx-auto max-w-6xl px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <h3 className="label-caps mb-4">{settings.footerColumn1Heading}</h3>
          <p className="text-sm text-stone max-w-xs whitespace-pre-line">{settings.footerColumn1Body}</p>
        </div>
        <div>
          <h3 className="label-caps mb-4">{settings.footerColumn2Heading}</h3>
          <p className="text-sm text-stone mb-4 whitespace-pre-line">{settings.footerColumn2Body}</p>
          <NewsletterSignupForm />
          <Link href="/archive" className="mt-4 inline-block text-xs text-stone hover:text-ink underline">
            Browse past newsletters
          </Link>
        </div>
        <div>
          <h3 className="label-caps mb-4">{settings.footerLinksHeading}</h3>
          <ul className="text-sm text-stone space-y-2">
            {links.map((link) => (
              <li key={link.id}>
                <Link href={`/${link.slug}`} className="hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t hairline">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-stone flex justify-between">
          <span>&copy; {new Date().getFullYear()} {settings.footerCopyrightName}</span>
          <span>{settings.footerBadgeText}</span>
        </div>
      </div>
    </footer>
  );
}
