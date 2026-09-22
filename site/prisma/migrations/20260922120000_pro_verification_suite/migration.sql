-- AlterTable
ALTER TABLE "submission" ADD COLUMN     "brandId" TEXT;

-- CreateTable
CREATE TABLE "artist_brand_assignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artist_brand_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_edit_code" (
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedBySubmissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_edit_code_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "artist_brand_assignment_userId_idx" ON "artist_brand_assignment"("userId");

-- CreateIndex
CREATE INDEX "artist_brand_assignment_brandId_idx" ON "artist_brand_assignment"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "artist_brand_assignment_userId_brandId_key" ON "artist_brand_assignment"("userId", "brandId");

-- CreateIndex
CREATE INDEX "submission_edit_code_userId_idx" ON "submission_edit_code"("userId");

-- CreateIndex
CREATE INDEX "submission_edit_code_brandId_idx" ON "submission_edit_code"("brandId");

-- CreateIndex
CREATE INDEX "submission_brandId_idx" ON "submission"("brandId");

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_brand_assignment" ADD CONSTRAINT "artist_brand_assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_brand_assignment" ADD CONSTRAINT "artist_brand_assignment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_brand_assignment" ADD CONSTRAINT "artist_brand_assignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_edit_code" ADD CONSTRAINT "submission_edit_code_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_edit_code" ADD CONSTRAINT "submission_edit_code_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_edit_code" ADD CONSTRAINT "submission_edit_code_usedBySubmissionId_fkey" FOREIGN KEY ("usedBySubmissionId") REFERENCES "submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
