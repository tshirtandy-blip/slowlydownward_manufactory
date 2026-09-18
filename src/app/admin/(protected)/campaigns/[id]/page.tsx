import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CampaignForm } from "@/components/admin/campaigns/CampaignForm";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { cancelScheduledCampaignAction } from "../actions";

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

  return (
    <div className="max-w-2xl">
      <Link href="/admin/campaigns" className="label-caps text-stone hover:text-ink">
        ← Campaigns
      </Link>
      <h1 className="font-display text-2xl mt-2 mb-1">{campaign.subject}</h1>
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
              {counts["email.opened"] ?? 0} <span className="text-sm text-stone">({pct(counts["email.opened"] ?? 0)})</span>
            </p>
          </div>
          <div className="bg-paper p-4">
            <p className="label-caps text-stone mb-1">Clicked</p>
            <p className="font-display text-xl">
              {counts["email.clicked"] ?? 0} <span className="text-sm text-stone">({pct(counts["email.clicked"] ?? 0)})</span>
            </p>
          </div>
          <div className="bg-paper p-4">
            <p className="label-caps text-stone mb-1">Bounced</p>
            <p className="font-display text-xl">{counts["email.bounced"] ?? 0}</p>
          </div>
          <div className="bg-paper p-4">
            <p className="label-caps text-stone mb-1">Complained</p>
            <p className="font-display text-xl">{counts["email.complained"] ?? 0}</p>
          </div>
          <div className="bg-paper p-4">
            <p className="label-caps text-stone mb-1">Delivered</p>
            <p className="font-display text-xl">{counts["email.delivered"] ?? 0}</p>
          </div>
        </div>
      )}

      <p className="label-caps text-stone mb-2">Message</p>
      <div className="border hairline p-6 bg-white" dangerouslySetInnerHTML={{ __html: campaign.html }} />
    </div>
  );
}
