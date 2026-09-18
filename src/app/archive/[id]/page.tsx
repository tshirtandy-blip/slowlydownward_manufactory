import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { getFooterProps } from "@/lib/footer";
import { ArchiveCampaignBody } from "@/components/storefront/ArchiveCampaignBody";

export const dynamic = "force-dynamic";

// A previously-sent campaign, viewed the way anyone can from the archive
// list (src/app/archive/page.tsx) — never a draft or a still-scheduled one,
// same "only SENT is public" rule as that list applies here too, in case
// someone has an old link to a campaign that's since been pulled back to
// draft (see cancelScheduledCampaign in Admin > Campaigns).
async function getSentCampaign(id: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign || campaign.status !== "SENT") return null;
  return campaign;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const campaign = await getSentCampaign(params.id);
  if (!campaign) return {};
  return { title: `${campaign.subject} — Slowly Downward` };
}

export default async function ArchiveCampaignPage({ params }: { params: { id: string } }) {
  const campaign = await getSentCampaign(params.id);
  if (!campaign) notFound();

  const footer = await getFooterProps();

  return (
    <>
      <SiteHeader />
      <article className="mx-auto max-w-2xl px-6 py-20">
        <Link href="/archive" className="label-caps text-stone hover:text-ink">
          ← Newsletter archive
        </Link>
        <h1 className="font-display text-3xl mt-4 mb-2">{campaign.subject}</h1>
        {campaign.campaignName && <p className="text-sm text-stone mb-1">{campaign.campaignName}</p>}
        {campaign.sentAt && (
          <p className="text-sm text-stone mb-12">
            {campaign.sentAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        )}
        <ArchiveCampaignBody html={campaign.html} />
      </article>
      <SiteFooter {...footer} />
    </>
  );
}
