-- CreateTable
CREATE TABLE "creator_application" (
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "portfolio" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_application_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "creator_application_status_idx" ON "creator_application"("status");

-- AddForeignKey
ALTER TABLE "creator_application" ADD CONSTRAINT "creator_application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
