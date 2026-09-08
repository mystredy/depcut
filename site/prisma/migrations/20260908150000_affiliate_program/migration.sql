-- CreateTable
CREATE TABLE "affiliate" (
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_code_key" ON "affiliate"("code");

-- AddForeignKey
ALTER TABLE "affiliate" ADD CONSTRAINT "affiliate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "affiliate_referral" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "commissionRates" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_referral_referredUserId_key" ON "affiliate_referral"("referredUserId");

-- CreateIndex
CREATE INDEX "affiliate_referral_affiliateId_idx" ON "affiliate_referral"("affiliateId");

-- AddForeignKey
ALTER TABLE "affiliate_referral" ADD CONSTRAINT "affiliate_referral_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliate"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_referral" ADD CONSTRAINT "affiliate_referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "finance_settings" ADD COLUMN "affiliateCommissionRates" INTEGER NOT NULL DEFAULT 100;
