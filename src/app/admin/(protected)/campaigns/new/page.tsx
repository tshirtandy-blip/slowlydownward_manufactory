import Link from "next/link";
import { CampaignForm } from "@/components/admin/campaigns/CampaignForm";

export default function NewCampaignPage() {
  return (
    <div>
      <Link href="/admin/campaigns" className="label-caps text-stone hover:text-ink">
        ← Campaigns
      </Link>
      <h1 className="font-display text-2xl mt-2 mb-8">New campaign</h1>
      <CampaignForm campaignId={null} initialSubject="" initialHtml="" initialAudience="ALL" />
    </div>
  );
}
