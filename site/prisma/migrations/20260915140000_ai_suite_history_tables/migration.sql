-- CreateTable
CREATE TABLE "ScriptGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "tone" TEXT,
    "status" TEXT NOT NULL,
    "script" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScriptGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScriptGeneration_userId_createdAt_idx" ON "ScriptGeneration"("userId", "createdAt");

-- CreateTable
CREATE TABLE "VisualGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "aspect" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "outputKey" TEXT,
    "outputMime" TEXT,
    "durationSeconds" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisualGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisualGeneration_userId_createdAt_idx" ON "VisualGeneration"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "VisualGeneration_tool_createdAt_idx" ON "VisualGeneration"("tool", "createdAt");

-- CreateTable
CREATE TABLE "ChatGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatGeneration_userId_updatedAt_idx" ON "ChatGeneration"("userId", "updatedAt");
