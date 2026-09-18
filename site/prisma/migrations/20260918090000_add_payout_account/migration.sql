-- CreateTable
CREATE TABLE "payout_account" (
    "userId" TEXT NOT NULL,
    "available" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_account_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "payout_account" ADD CONSTRAINT "payout_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
