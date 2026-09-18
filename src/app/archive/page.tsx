import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { getFooterProps } from "@/lib/footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Newsletter archive — Slowly Downward",
  description: "Past newsletters and announcements from Slowly Downward, in one place.",
};

// Public "browse our past newsletters" page — every campaign sent from
// Admin > Campaigns (src/app/admin/(protected)/campaigns) lands here
// automatically the moment it's sent, since it's reading the same Campaign
// table that page writes to; nothing separate to publish or sync. Only
// SENT campaigns show — a still-DRAFT or SCHEDULED one obviously isn't
// public yet, and a FAILED send never went out to anyone.
async function getSentCampaigns() {
  return prisma.campaign.findMany({
    where: { status: "SENT" },
    orderBy: { sentAt: "desc" },
    select: { id: true, subject: true, sentAt: true },
  });
}

export default async function ArchivePage() {
  const [campaigns, footer] = await Promise.all([getSentCampaigns(), getFooterProps()]);

  return (
    <>
      <SiteHeader />
      <section className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="font-display text-3xl mb-3">Newsletter archive</h1>
        <p className="text-stone mb-12">
          Everything we've sent out, kept here for anyone who'd like to look back.
        </p>

        {campaigns.length === 0 ? (
          <p className="text-stone">Nothing sent yet — check back after our first newsletter goes out.</p>
        ) : (
          <ul className="divide-y hairline border-t border-b hairline">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/archive/${c.id}`}
                  className="flex items-baseline justify-between gap-6 py-5 hover:text-stone"
                >
                  <span className="font-display text-lg">{c.subject}</span>
                  <span className="text-xs text-stone whitespace-nowrap">
                    {c.sentAt?.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <SiteFooter {...footer} />
    </>
  );
}
