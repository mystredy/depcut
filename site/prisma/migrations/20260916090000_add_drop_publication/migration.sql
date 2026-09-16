-- CreateTable
CREATE TABLE "drop_publication" (
    "id" TEXT NOT NULL,
    "dropId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "destinationConnectionId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "destinationAccountName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "externalPostId" TEXT,
    "externalUrl" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drop_publication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drop_publication_dropId_idx" ON "drop_publication"("dropId");

-- CreateIndex
CREATE INDEX "drop_publication_destinationConnectionId_idx" ON "drop_publication"("destinationConnectionId");

-- AddForeignKey
ALTER TABLE "drop_publication" ADD CONSTRAINT "drop_publication_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "drop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
