-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "marketingConsentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "withdrawalReason" TEXT,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "cookiePopupEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cookiePopupMessage" TEXT NOT NULL DEFAULT 'We use a few essential cookies to keep the site and your basket working. Nothing beyond that.',
ADD COLUMN     "cookiePopupSignupBody" TEXT NOT NULL DEFAULT 'Leave your email if you''d like to know when a new print goes live, before it''s announced anywhere else.',
ADD COLUMN     "cookiePopupSignupHeading" TEXT NOT NULL DEFAULT 'Hear about new releases',
ADD COLUMN     "withdrawalPeriodDays" INTEGER NOT NULL DEFAULT 14;
