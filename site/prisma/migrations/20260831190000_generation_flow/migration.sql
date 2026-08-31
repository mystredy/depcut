-- CreateTable
CREATE TABLE "GenerationFlow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coverKey" TEXT,
    "coverIsAuto" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowGeneration" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "refMode" TEXT,
    "referenceKeys" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "errorMessage" TEXT,
    "outputKey" TEXT,
    "outputMime" TEXT,
    "posterKey" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" DOUBLE PRECISION,
    "providerJobId" TEXT,
    "providerGenerationId" TEXT,
    "providerPollingUrl" TEXT,
    "providerPayload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenerationFlow_userId_updatedAt_idx" ON "GenerationFlow"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "FlowGeneration_flowId_createdAt_idx" ON "FlowGeneration"("flowId", "createdAt");

-- CreateIndex
CREATE INDEX "FlowGeneration_status_updatedAt_idx" ON "FlowGeneration"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "FlowGeneration" ADD CONSTRAINT "FlowGeneration_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "GenerationFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
