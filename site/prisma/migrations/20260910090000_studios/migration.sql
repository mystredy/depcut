-- Studio and its child tables were created directly against production
-- ahead of this migration file (and later carried a showFollowerCount
-- column added the same way user.showFollowerCount was) — every statement
-- here is guarded so `prisma migrate deploy` no-ops against what's already
-- there and only adds what's genuinely missing (studioId on
-- social_connection and space_post).

ALTER TABLE "social_connection" ADD COLUMN IF NOT EXISTS "studioId" TEXT;
ALTER TABLE "space_post" ADD COLUMN IF NOT EXISTS "studioId" TEXT;

CREATE TABLE IF NOT EXISTS "studio" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "bio" TEXT,
    "avatarImageKey" TEXT,
    "backgroundImageKey" TEXT,
    "spaceType" TEXT NOT NULL DEFAULT 'Creator',
    "ownerId" TEXT NOT NULL,
    "linkedAccounts" JSONB,
    "showFollowerCount" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "studio_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "studio" ADD COLUMN IF NOT EXISTS "showFollowerCount" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "studio_member" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'manager',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "studio_member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "studio_invite" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'manager',
    "invitedById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "studio_invite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "studio_activity" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "studio_activity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "studio_username_key" ON "studio"("username");
CREATE INDEX IF NOT EXISTS "studio_ownerId_idx" ON "studio"("ownerId");
CREATE INDEX IF NOT EXISTS "studio_member_userId_idx" ON "studio_member"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "studio_member_studioId_userId_key" ON "studio_member"("studioId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "studio_invite_token_key" ON "studio_invite"("token");
CREATE INDEX IF NOT EXISTS "studio_invite_studioId_idx" ON "studio_invite"("studioId");
CREATE INDEX IF NOT EXISTS "studio_invite_email_idx" ON "studio_invite"("email");
CREATE INDEX IF NOT EXISTS "studio_activity_studioId_idx" ON "studio_activity"("studioId");
CREATE INDEX IF NOT EXISTS "social_connection_studioId_idx" ON "social_connection"("studioId");
CREATE INDEX IF NOT EXISTS "space_post_studioId_idx" ON "space_post"("studioId");

DO $$ BEGIN
  ALTER TABLE "studio" ADD CONSTRAINT "studio_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "studio_member" ADD CONSTRAINT "studio_member_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "studio_member" ADD CONSTRAINT "studio_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "studio_invite" ADD CONSTRAINT "studio_invite_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "studio_invite" ADD CONSTRAINT "studio_invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "studio_activity" ADD CONSTRAINT "studio_activity_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "studio_activity" ADD CONSTRAINT "studio_activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "social_connection" ADD CONSTRAINT "social_connection_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "space_post" ADD CONSTRAINT "space_post_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
