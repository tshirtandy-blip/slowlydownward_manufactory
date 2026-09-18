-- CreateTable
CREATE TABLE "CoaTemplate" (
    "id" TEXT NOT NULL,
    "printId" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Certificate of Authenticity',
    "pageSize" TEXT NOT NULL DEFAULT 'A5',
    "bodyHtml" TEXT NOT NULL DEFAULT '',
    "css" TEXT NOT NULL DEFAULT '',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoaTemplate_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "editionConfirmedByPacker" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "editionConfirmedAt" TIMESTAMP(3),
ADD COLUMN "editionConfirmedByUserId" TEXT,
ADD COLUMN "coaPrintedAt" TIMESTAMP(3),
ADD COLUMN "coaPrintedByUserId" TEXT,
ADD COLUMN "packed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "packedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "CoaTemplate_printId_key" ON "CoaTemplate"("printId");

-- AddForeignKey
ALTER TABLE "CoaTemplate" ADD CONSTRAINT "CoaTemplate_printId_fkey" FOREIGN KEY ("printId") REFERENCES "Print"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaTemplate" ADD CONSTRAINT "CoaTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_editionConfirmedByUserId_fkey" FOREIGN KEY ("editionConfirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_coaPrintedByUserId_fkey" FOREIGN KEY ("coaPrintedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
