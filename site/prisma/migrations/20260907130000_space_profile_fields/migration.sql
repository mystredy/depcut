-- AlterTable
ALTER TABLE "user"
ADD COLUMN "username" TEXT,
ADD COLUMN "bio" TEXT,
ADD COLUMN "location" TEXT,
ADD COLUMN "backgroundImageKey" TEXT,
ADD COLUMN "showFollowerCount" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");
