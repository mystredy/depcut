-- AlterTable
ALTER TABLE "drop" ADD COLUMN "importedPlatform" TEXT,
ADD COLUMN "importedExternalId" TEXT;

-- CreateIndex
CREATE INDEX "drop_studioId_importedPlatform_importedExternalId_idx" ON "drop"("studioId", "importedPlatform", "importedExternalId");
