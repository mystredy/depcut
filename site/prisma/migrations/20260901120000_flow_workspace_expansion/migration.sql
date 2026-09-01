-- Written to be safe to re-run: an earlier attempt on this database
-- partially applied (this repo's migrations are pasted by hand, not run
-- through `prisma migrate deploy`), so every statement here is guarded to
-- no-op on whatever already landed rather than requiring a hand inspection
-- of the database first.

-- AlterTable
ALTER TABLE "FlowGeneration" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "FlowGeneration" ADD COLUMN IF NOT EXISTS "favorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FlowGeneration" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "FlowGeneration" ADD COLUMN IF NOT EXISTS "parentGenerationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FlowGeneration_idempotencyKey_key" ON "FlowGeneration"("idempotencyKey");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FlowGeneration" ADD CONSTRAINT "FlowGeneration_parentGenerationId_fkey" FOREIGN KEY ("parentGenerationId") REFERENCES "FlowGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "FlowCollection" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FlowCollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlowCollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FlowGenerationReport" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlowGenerationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FlowScene" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Untitled scene',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowScene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FlowSceneClip" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "trimInSeconds" DOUBLE PRECISION,
    "trimOutSeconds" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlowSceneClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FlowCollection_flowId_updatedAt_idx" ON "FlowCollection"("flowId", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FlowCollectionItem_generationId_idx" ON "FlowCollectionItem"("generationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FlowCollectionItem_collectionId_generationId_key" ON "FlowCollectionItem"("collectionId", "generationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FlowGenerationReport_generationId_idx" ON "FlowGenerationReport"("generationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FlowGenerationReport_flowId_idx" ON "FlowGenerationReport"("flowId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FlowScene_flowId_updatedAt_idx" ON "FlowScene"("flowId", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FlowSceneClip_generationId_idx" ON "FlowSceneClip"("generationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FlowSceneClip_sceneId_position_key" ON "FlowSceneClip"("sceneId", "position");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FlowCollection" ADD CONSTRAINT "FlowCollection_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "GenerationFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FlowCollectionItem" ADD CONSTRAINT "FlowCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FlowCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FlowCollectionItem" ADD CONSTRAINT "FlowCollectionItem_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "FlowGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FlowGenerationReport" ADD CONSTRAINT "FlowGenerationReport_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "FlowGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FlowScene" ADD CONSTRAINT "FlowScene_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "GenerationFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FlowSceneClip" ADD CONSTRAINT "FlowSceneClip_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "FlowScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FlowSceneClip" ADD CONSTRAINT "FlowSceneClip_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "FlowGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
