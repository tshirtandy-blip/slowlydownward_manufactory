import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { FooterContentForm } from "./FooterContentForm";
import { FooterLinksManager, type FooterLinkEditable } from "./FooterLinksManager";
import { SocialLinksManager } from "./SocialLinksManager";

export const dynamic = "force-dynamic";

export default async function FooterSettingsPage() {
  const [settings, links, socialLinks] = await Promise.all([
    getSiteSettings(),
    prisma.footerLink.findMany({
      orderBy: { sortOrder: "asc" },
      include: { page: { select: { id: true, title: true, slug: true } } },
    }),
    prisma.socialLink.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const editableLinks: FooterLinkEditable[] = links.map((l) => ({
    id: l.id,
    label: l.label,
    pageId: l.page.id,
    pageTitle: l.page.title,
    pageSlug: l.page.slug,
  }));

  return (
    <div className="max-w-3xl">
      <Link href="/admin/settings" className="label-caps text-stone hover:text-ink">
        ← Settings
      </Link>
      <h1 className="font-display text-2xl mt-2 mb-2">Footer</h1>
      <p className="text-sm text-stone mb-8 max-w-xl">
        Everything shown at the bottom of every page — the two text columns, the "Information" links, and the
        copyright line — is editable here.
      </p>

      <h2 className="font-display text-xl mb-4">Text</h2>
      <FooterContentForm settings={settings} />

      <div className="border-t border-line mt-12 pt-8">
        <h2 className="font-display text-xl mb-2">Links</h2>
        <p className="text-sm text-stone mb-6 max-w-xl">
          Each link opens a page built in Admin → Pages — you can rename how it reads in the footer without
          renaming the page itself, reorder the list, remove a link without deleting its page, or add a whole new
          page from here.
        </p>
        <FooterLinksManager links={editableLinks} />
      </div>

      <div className="border-t border-line mt-12 pt-8">
        <h2 className="font-display text-xl mb-2">Social links</h2>
        <p className="text-sm text-stone mb-6 max-w-xl">
          Shown bottom-left on every storefront page, next to "{settings.footerColumn1Heading}". Any platform —
          Instagram, Facebook, TikTok, whatever you're on.
        </p>
        <SocialLinksManager links={socialLinks.map((s) => ({ id: s.id, platform: s.platform, url: s.url }))} />
      </div>
    </div>
  );
}
