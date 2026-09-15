-- CreateTable
CREATE TABLE "TranscriptionGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "language" TEXT,
    "transcript" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptionGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranscriptionGeneration_userId_createdAt_idx" ON "TranscriptionGeneration"("userId", "createdAt");
