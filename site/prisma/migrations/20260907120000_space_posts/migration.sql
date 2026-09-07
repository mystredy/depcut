-- CreateTable
CREATE TABLE "space_post" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "caption" TEXT,
    "fileName" TEXT,
    "storageKey" TEXT,
    "thumbnailKey" TEXT,
    "sizeBytes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "space_post_userId_idx" ON "space_post"("userId");

-- CreateIndex
CREATE INDEX "space_post_status_idx" ON "space_post"("status");

-- AddForeignKey
ALTER TABLE "space_post" ADD CONSTRAINT "space_post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
