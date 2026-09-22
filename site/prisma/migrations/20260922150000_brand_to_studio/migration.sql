-- DropForeignKey
ALTER TABLE "artist_brand_assignment" DROP CONSTRAINT "artist_brand_assignment_assignedById_fkey";
ALTER TABLE "artist_brand_assignment" DROP CONSTRAINT "artist_brand_assignment_brandId_fkey";
ALTER TABLE "artist_brand_assignment" DROP CONSTRAINT "artist_brand_assignment_userId_fkey";
ALTER TABLE "submission" DROP CONSTRAINT "submission_brandId_fkey";
ALTER TABLE "submission_edit_code" DROP CONSTRAINT "submission_edit_code_brandId_fkey";

-- DropIndex
DROP INDEX "submission_brandId_idx";
DROP INDEX "submission_edit_code_brandId_idx";

-- Test rows tied to the old (wrong-entity) Brand columns — nothing real has
-- ever been submitted against them, so they're discarded rather than
-- migrated. Required before the NOT NULL studioId column below can be added.
DELETE FROM "submission_edit_code";
DROP TABLE "artist_brand_assignment";

-- AlterTable
ALTER TABLE "submission" DROP COLUMN "brandId",
ADD COLUMN     "studioId" TEXT;

-- AlterTable
ALTER TABLE "submission_edit_code" DROP COLUMN "brandId",
ADD COLUMN     "studioId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "artist_studio_assignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artist_studio_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "artist_studio_assignment_userId_idx" ON "artist_studio_assignment"("userId");
CREATE INDEX "artist_studio_assignment_studioId_idx" ON "artist_studio_assignment"("studioId");
CREATE UNIQUE INDEX "artist_studio_assignment_userId_studioId_key" ON "artist_studio_assignment"("userId", "studioId");
CREATE INDEX "submission_studioId_idx" ON "submission"("studioId");
CREATE INDEX "submission_edit_code_studioId_idx" ON "submission_edit_code"("studioId");

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "artist_studio_assignment" ADD CONSTRAINT "artist_studio_assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "artist_studio_assignment" ADD CONSTRAINT "artist_studio_assignment_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "artist_studio_assignment" ADD CONSTRAINT "artist_studio_assignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "submission_edit_code" ADD CONSTRAINT "submission_edit_code_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
