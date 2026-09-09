-- AlterTable
ALTER TABLE "creator_rate_account" ADD COLUMN     "tier" TEXT NOT NULL DEFAULT 'Standard';

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "submitProjectRequiresPro" BOOLEAN NOT NULL DEFAULT false;

