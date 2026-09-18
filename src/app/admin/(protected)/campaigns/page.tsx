import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { resendBroadcastsConfigured } from "@/lib/integrations/resend-broadcasts";
import { deleteCampaign } from "./actions";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  SENDING: "Sending",
  SENT: "Sent",
  FAILED: "Failed",
};

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { events: { where: { type: "email.opened" } } } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl">Campaigns</h1>
        <Link href="/admin/campaigns/new" className="btn-primary !px-4 !py-2">
          New campaign
        </Link>
      </div>

      {!resendBroadcastsConfigured() && (
        <p className="mb-6 text-sm text-stone border hairline p-4">
          Resend isn't configured yet — add <code className="text-ink">RESEND_API_KEY</code> and{" "}
          <code className="text-ink">RESEND_FROM_EMAIL</code> to your environment (Admin &gt; Settings &gt;
          Integrations shows the status). Drafts can still be written and saved in the meantime.
        </p>
      )}

      <div className="border hairline">
        <table className="w-full text-sm">
          <thead>
            <tr className="label-caps text-left border-b hairline">
              <th className="p-3">Campaign</th>
              <th className="p-3">Audience</th>
              <th className="p-3">Status</th>
              <th className="p-3">Sent / scheduled</th>
              <th className="p-3">Recipients</th>
              <th className="p-3">Opens</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b hairline last:border-0 hover:bg-line/40">
                <td className="p-3">
                  {/* Mailchimp's own campaign name is what actually tells two
                      similarly-worded imports apart — the subject line often
                      repeats across a whole run of newsletters, so it's shown
                      as the primary label here (with the subject underneath)
                      whenever a campaign has one; a campaign composed here has
                      no separate name, so it just shows its subject as before. */}
                  <Link href={`/admin/campaigns/${c.id}`} className="underline">
                    {c.campaignName || c.subject}
                  </Link>
                  {c.campaignName && <span className="block text-xs text-stone">{c.subject}</span>}
                </td>
                <td className="p-3 text-stone">{c.audience === "CUSTOMERS" ? "Customers" : "Everyone"}</td>
                <td className="p-3 text-stone">{STATUS_LABEL[c.status] ?? c.status}</td>
                <td className="p-3 text-stone">
                  {c.sentAt
                    ? c.sentAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
                    : c.scheduledFor
                    ? c.scheduledFor.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
                    : "—"}
                </td>
                <td className="p-3 text-stone">{c.recipientCount ?? "—"}</td>
                <td className="p-3 text-stone">
                  {(() => {
                    // A campaign imported from Mailchimp has no live "email.opened"
                    // events (nothing was ever sent through Resend for it) — fall
                    // back to the one-time Mailchimp stats snapshot taken at import.
                    const opens = c._count.events || c.mailchimpOpens || 0;
                    return c.status === "SENT" && c.recipientCount
                      ? `${opens} (${Math.round((opens / c.recipientCount) * 100)}%)`
                      : "—";
                  })()}
                </td>
                <td className="p-3 text-right">
                  {c.status !== "SCHEDULED" && c.status !== "SENDING" && (
                    <form action={deleteCampaign.bind(null, c.id)}>
                      <ConfirmSubmitButton
                        confirmText={
                          c.status === "SENT"
                            ? `Delete "${c.subject}"? It'll also disappear from the public newsletter archive. This can't be undone.`
                            : `Delete "${c.subject}"? This can't be undone.`
                        }
                        className="text-xs text-stone hover:text-ink underline"
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-stone">
                  No campaigns yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
