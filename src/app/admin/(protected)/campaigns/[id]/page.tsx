import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CampaignForm } from "@/components/admin/campaigns/CampaignForm";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { cancelScheduledCampaignAction, deleteCampaign } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  SENDING: "Sending",
  SENT: "Sent",
  FAILED: "Failed",
};

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
  if (!campaign) notFound();

  if (campaign.status === "DRAFT") {
    return (
      <div>
        <Link href="/admin/campaigns" className="label-caps text-stone hover:text-ink">
          ← Campaigns
        </Link>
        <h1 className="font-display text-2xl mt-2 mb-8">Edit draft</h1>
        <CampaignForm
          campaignId={campaign.id}
          initialSubject={campaign.subject}
          initialHtml={campaign.html}
          initialAudience={campaign.audience}
        />
      </div>
    );
  }

  const eventCounts = await prisma.campaignEvent.groupBy({
    by: ["type"],
    where: { campaignId: campaign.id },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(eventCounts.map((e) => [e.type, e._count._all]));
  const recipientCount = campaign.recipientCount ?? 0;
  const pct = (n: number) => (recipientCount ? `${Math.round((n / recipientCount) * 100)}%` : "—");

  // A campaign imported from Mailchimp (scripts/import-mailchimp-campaigns.ts)
  // was never actually sent through Resend, so it has no CampaignEvent rows
  // at all — `counts` is empty for it. Fall back to the one-time Mailchimp
  // stats snapshot taken at import time in that case; a campaign sent from
  // here always has real (possibly zero) event counts, which take priority.
  const opened = counts["email.opened"] ?? campaign.mailchimpOpens ?? 0;
  const clicked = counts["email.clicked"] ?? campaign.mailchimpClicks ?? 0;
  const bounced = counts["email.bounced"] ?? campaign.mailchimpBounces ?? 0;
  const complained = counts["email.complained"] ?? campaign.mailchimpComplaints ?? 0;
  // Mailchimp's report API has no direct "delivered" figure — recipients
  // minus bounces is the closest honest estimate for an imported campaign.
  const delivered = counts["email.delivered"] ?? (campaign.mailchimpCampaignId ? Math.max(recipientCount - bounced, 0) : 0);

  return (
    <div className="max-w-2xl">
      <Link href="/admin/campaigns" className="label-caps text-stone hover:text-ink">
        ← Campaigns
      </Link>
      <h1 className="font-display text-2xl mt-2 mb-1">{campaign.subject}</h1>
      {campaign.campaignName && <p className="text-sm text-stone mb-1">Mailchimp name: {campaign.campaignName}</p>}
      <p className="text-stone text-sm mb-8">
        {STATUS_LABEL[campaign.status] ?? campaign.status} — {campaign.audience === "CUSTOMERS" ? "Customers" : "Everyone"}{" "}
        opted in
        {campaign.sentAt && ` — sent ${campaign.sentAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}`}
        {campaign.scheduledFor &&
          !campaign.sentAt &&
          ` — sending ${campaign.scheduledFor.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}`}
      </p>

      {campaign.status === "SCHEDULED" && (
        <form action={cancelScheduledCampaignAction.bind(null, campaign.id)} className="mb-8">
          <ConfirmSubmitButton
            confirmText="Cancel this scheduled send and pull it back to a draft?"
            className="btn-secondary !px-4 !py-2"
          >
            Cancel scheduled send
          </ConfirmSubmitButton>
        </form>
      )}

      {(campaign.status === "SENT" || campaign.status === "SENDING") && (
        <div className="grid grid-cols-3 gap-px bg-line border hairline mb-8">
          <div className="bg-paper p-4">
            <p className="label-caps text-stone mb-1">Recipients</p>
            <p className="font-display text-xl">{recipientCount.toLocaleString()}</p>
          </div>
          <div className="bg-paper p-4">
            <p className="label-caps text-stone mb-1">Opened</p>
            <p className="font-display text-xl">
              {opened} <span className="text-sm text-stone">({pct(opened)})</span>
            </p>
          </div>
          <div className="bg-paper p-4">
            <p className="label-caps text-stone mb-1">Clicked</p>
            <p className="font-display text-xl">
              {clicked} <span className="text-sm text-stone">({pct(clicked)})</span>
            </p>
          </div>
          <div className="bg-paper p-4">
            <p className="label-caps text-stone mb-1">Bounced</p>
            <p className="font-display text-xl">{bounced}</p>
          </div>
          <div className="bg-paper p-4">
            <p className="label-caps text-stone mb-1">Complained</p>
            <p className="font-display text-xl">{complained}</p>
          </div>
          <div className="bg-paper p-4">
            <p className="label-caps text-stone mb-1">Delivered</p>
            <p className="font-display text-xl">{delivered}</p>
          </div>
        </div>
      )}
      {campaign.mailchimpCampaignId && (
        <p className="text-xs text-stone mb-8 -mt-6">
          Opens/clicks/bounces/complaints above are a one-time snapshot from Mailchimp taken when this campaign was
          imported, not live — this campaign was never actually sent through Resend.
        </p>
      )}

      <p className="label-caps text-stone mb-2">Message</p>
      <div className="border hairline p-6 bg-white mb-8" dangerouslySetInnerHTML={{ __html: campaign.html }} />

      {campaign.status !== "SCHEDULED" && campaign.status !== "SENDING" && (
        <form action={deleteCampaign.bind(null, campaign.id)}>
          <ConfirmSubmitButton
            confirmText={
              campaign.status === "SENT"
                ? "Delete this campaign? It'll also disappear from the public newsletter archive. This can't be undone."
                : "Delete this campaign? This can't be undone."
            }
            className="text-sm text-stone hover:text-ink underline"
          >
            Delete this campaign
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
