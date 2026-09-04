-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN "logoLight" BYTEA,
ADD COLUMN "logoLightContentType" TEXT,
ADD COLUMN "logoDark" BYTEA,
ADD COLUMN "logoDarkContentType" TEXT,
ADD COLUMN "favicon" BYTEA,
ADD COLUMN "faviconContentType" TEXT;
