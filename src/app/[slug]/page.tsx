import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { parseBlocks } from "@/lib/blocks";
import { authOptions } from "@/lib/auth";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { getFooterProps } from "@/lib/footer";
import { BlockRenderer } from "@/components/storefront/BlockRenderer";

export const dynamic = "force-dynamic";

// Standalone pages built in Admin → Pages, served at /<slug>. Literal
// top-level routes (cart, checkout, prints, admin, api) always win over this
// dynamic segment, so there's no risk of collision with the rest of the app.
async function getViewablePage(slug: string) {
  const page = await prisma.page.findUnique({ where: { slug } });
  if (!page) return null;

  if (page.status === "PUBLISHED") return page;

  // Drafts are visible only to a signed-in admin, previewing their own work.
  const session = await getServerSession(authOptions);
  if (session?.user.role === "ADMIN") return page;

  return null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const page = await getViewablePage(params.slug);
  if (!page) return {};
  return {
    title: `${page.title} — Slowly Downward`,
    description: page.seoDescription ?? undefined,
  };
}

export default async function CustomPage({ params }: { params: { slug: string } }) {
  const page = await getViewablePage(params.slug);
  if (!page) notFound();

  const blocks = parseBlocks(page.blocks);
  const footer = await getFooterProps();

  return (
    <>
      <SiteHeader />
      {page.status === "DRAFT" && (
        <div className="bg-accent text-paper text-center text-xs uppercase tracking-widest2 py-2">
          Draft — only visible to you
        </div>
      )}
      {blocks.length === 0 ? (
        <section className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="font-display text-3xl mb-4">{page.title}</h1>
          <p className="text-stone">This page doesn't have any content yet.</p>
        </section>
      ) : (
        <BlockRenderer blocks={blocks} />
      )}
      <SiteFooter {...footer} />
    </>
  );
}
