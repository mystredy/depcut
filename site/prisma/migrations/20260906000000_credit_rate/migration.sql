-- AlterTable
ALTER TABLE "app_settings"
ADD COLUMN "creditRateCredits" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN "creditRateDollars" INTEGER NOT NULL DEFAULT 3;
