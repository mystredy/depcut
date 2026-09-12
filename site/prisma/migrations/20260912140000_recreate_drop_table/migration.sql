-- The "drop" table was dropped directly against the database (not through
-- a migration), so _prisma_migrations has no record of its removal and no
-- migration to roll back. This recreates it from scratch, matching
-- Drop.prisma exactly. Any rows that existed before the drop are gone —
-- this restores structure only, not data.
CREATE TABLE "drop" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
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

    CONSTRAINT "drop_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "drop_userId_idx" ON "drop"("userId");

CREATE INDEX "drop_status_idx" ON "drop"("status");

CREATE INDEX "drop_studioId_idx" ON "drop"("studioId");

ALTER TABLE "drop" ADD CONSTRAINT "drop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "drop" ADD CONSTRAINT "drop_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
