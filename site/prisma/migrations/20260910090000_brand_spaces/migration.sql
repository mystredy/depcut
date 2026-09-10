-- AlterTable
ALTER TABLE "social_connection" ADD COLUMN     "brandSpaceId" TEXT;

-- AlterTable
ALTER TABLE "space_post" ADD COLUMN     "brandSpaceId" TEXT;

-- CreateTable
CREATE TABLE "brand_space" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "bio" TEXT,
    "avatarImageKey" TEXT,
    "backgroundImageKey" TEXT,
    "spaceType" TEXT NOT NULL DEFAULT 'Creator',
    "ownerId" TEXT NOT NULL,
    "linkedAccounts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_space_member" (
    "id" TEXT NOT NULL,
    "brandSpaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'manager',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_space_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_space_invite" (
    "id" TEXT NOT NULL,
    "brandSpaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'manager',
    "invitedById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_space_invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_space_activity" (
    "id" TEXT NOT NULL,
    "brandSpaceId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_space_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_space_username_key" ON "brand_space"("username");

-- CreateIndex
CREATE INDEX "brand_space_ownerId_idx" ON "brand_space"("ownerId");

-- CreateIndex
CREATE INDEX "brand_space_member_userId_idx" ON "brand_space_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "brand_space_member_brandSpaceId_userId_key" ON "brand_space_member"("brandSpaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "brand_space_invite_token_key" ON "brand_space_invite"("token");

-- CreateIndex
CREATE INDEX "brand_space_invite_brandSpaceId_idx" ON "brand_space_invite"("brandSpaceId");

-- CreateIndex
CREATE INDEX "brand_space_invite_email_idx" ON "brand_space_invite"("email");

-- CreateIndex
CREATE INDEX "brand_space_activity_brandSpaceId_idx" ON "brand_space_activity"("brandSpaceId");

-- CreateIndex
CREATE INDEX "social_connection_brandSpaceId_idx" ON "social_connection"("brandSpaceId");

-- CreateIndex
CREATE INDEX "space_post_brandSpaceId_idx" ON "space_post"("brandSpaceId");

-- AddForeignKey
ALTER TABLE "brand_space" ADD CONSTRAINT "brand_space_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_space_member" ADD CONSTRAINT "brand_space_member_brandSpaceId_fkey" FOREIGN KEY ("brandSpaceId") REFERENCES "brand_space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_space_member" ADD CONSTRAINT "brand_space_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_space_invite" ADD CONSTRAINT "brand_space_invite_brandSpaceId_fkey" FOREIGN KEY ("brandSpaceId") REFERENCES "brand_space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_space_invite" ADD CONSTRAINT "brand_space_invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_space_activity" ADD CONSTRAINT "brand_space_activity_brandSpaceId_fkey" FOREIGN KEY ("brandSpaceId") REFERENCES "brand_space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_space_activity" ADD CONSTRAINT "brand_space_activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_connection" ADD CONSTRAINT "social_connection_brandSpaceId_fkey" FOREIGN KEY ("brandSpaceId") REFERENCES "brand_space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_post" ADD CONSTRAINT "space_post_brandSpaceId_fkey" FOREIGN KEY ("brandSpaceId") REFERENCES "brand_space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

