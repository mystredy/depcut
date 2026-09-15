-- DropTable
DROP TABLE "TranscriptionGeneration";

-- CreateTable
CREATE TABLE "TranscriptionGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "fileMime" TEXT,
    "fileSizeBytes" INTEGER,
    "language" TEXT,
    "tagAudioEvents" BOOLEAN NOT NULL DEFAULT false,
    "noVerbatim" BOOLEAN NOT NULL DEFAULT false,
    "diarize" BOOLEAN NOT NULL DEFAULT false,
    "keyterms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL,
    "transcript" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptionGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranscriptionGeneration_userId_createdAt_idx" ON "TranscriptionGeneration"("userId", "createdAt");
