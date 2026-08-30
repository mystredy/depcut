-- CreateTable
CREATE TABLE "ai_model" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_key_key" ON "ai_model"("key");
