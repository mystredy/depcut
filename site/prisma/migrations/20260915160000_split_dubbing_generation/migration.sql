-- CreateTable
CREATE TABLE "DubbingGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "direction" TEXT,
    "voice" TEXT NOT NULL,
    "language" TEXT,
    "sourceLabel" TEXT,
    "transcript" TEXT,
    "targetLanguage" TEXT,
    "outputKey" TEXT NOT NULL,
    "outputMime" TEXT NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DubbingGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DubbingGeneration_userId_createdAt_idx" ON "DubbingGeneration"("userId", "createdAt");

-- DropIndex
DROP INDEX "AudioGeneration_tool_createdAt_idx";

-- AlterTable
-- No existing row has a non-null value in these columns (verified: the
-- table's one row is tool='text-to-speech' with sourceLabel/transcript/
-- targetLanguage all null), so this is lossless for current data.
ALTER TABLE "AudioGeneration"
  DROP COLUMN "tool",
  DROP COLUMN "sourceLabel",
  DROP COLUMN "transcript",
  DROP COLUMN "targetLanguage";
