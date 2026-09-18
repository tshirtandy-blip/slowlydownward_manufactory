-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "mailchimpCampaignId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_mailchimpCampaignId_key" ON "Campaign"("mailchimpCampaignId");
