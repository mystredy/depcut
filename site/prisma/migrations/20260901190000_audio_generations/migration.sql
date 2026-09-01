-- CreateTable
CREATE TABLE "AudioGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
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

    CONSTRAINT "AudioGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AudioGeneration_userId_createdAt_idx" ON "AudioGeneration"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AudioGeneration_tool_createdAt_idx" ON "AudioGeneration"("tool", "createdAt");
