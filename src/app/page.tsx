import { prisma } from "@/lib/prisma";
import { parseBlocks, type Block } from "@/lib/blocks";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { getFooterProps } from "@/lib/footer";
import { BlockRenderer } from "@/components/storefront/BlockRenderer";

export const dynamic = "force-dynamic";

// Used only if no "home" Page row exists yet (e.g. before the first
// `npm run seed`, or on an install that predates the page builder) — the
// home page should never come up blank.
function fallbackHomeBlocks(): Block[] {
  return [
    {
      id: "fallback-hero",
      type: "hero",
      eyebrow: "Stanley Donwood — Limited Editions",
      heading: "Prints made slowly, released rarely, gone for good.",
      subheading:
        "Every print is hand-numbered from a strictly limited edition. When the edition sells out, it is not reprinted.",
    },
    { id: "fallback-grid", type: "printGrid", mode: "all" },
  ];
}

export default async function HomePage() {
  const homePage = await prisma.page.findUnique({ where: { slug: "home" } });
  const blocks = homePage ? parseBlocks(homePage.blocks) : [];
  const footer = await getFooterProps();

  return (
    <>
      <SiteHeader />
      <BlockRenderer blocks={blocks.length > 0 ? blocks : fallbackHomeBlocks()} />
      <SiteFooter {...footer} />
    </>
  );
}
