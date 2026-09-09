-- AlterTable
ALTER TABLE "social_connection" ADD COLUMN     "platformAccountId" TEXT,
ADD COLUMN     "profileImage" TEXT,
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "social_connection_userId_idx" ON "social_connection"("userId");

-- AddForeignKey
ALTER TABLE "social_connection" ADD CONSTRAINT "social_connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
