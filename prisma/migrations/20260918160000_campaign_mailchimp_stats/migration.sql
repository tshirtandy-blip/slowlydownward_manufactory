-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "mailchimpOpens" INTEGER,
ADD COLUMN     "mailchimpClicks" INTEGER,
ADD COLUMN     "mailchimpBounces" INTEGER,
ADD COLUMN     "mailchimpComplaints" INTEGER;
