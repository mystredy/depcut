-- Turn every account's existing personal Space into a real, explicit space —
-- "My Space" was always-on and tied straight to the account; from here it's
-- just the first channel a user happens to have, created the same way as
-- any other. No collision check needed: verified live that no user.username
-- overlaps an existing brand_space.username before writing this.

-- AlterTable: brand_space gains what personal Space had that it didn't.
ALTER TABLE "brand_space" ADD COLUMN "showFollowerCount" BOOLEAN NOT NULL DEFAULT true;

-- One brand_space + owner brand_space_member per user who ever set a
-- personal-Space username. Deterministic ids so this is safe to review and
-- re-run.
INSERT INTO "brand_space" (id, name, username, bio, "backgroundImageKey", "showFollowerCount", "spaceType", "ownerId", "createdAt", "updatedAt")
SELECT
  'legacy-space-' || u.id,
  COALESCE(u."displayName", u.name),
  u.username,
  u.bio,
  u."backgroundImageKey",
  u."showFollowerCount",
  'Creator',
  u.id,
  now(),
  now()
FROM "user" u
WHERE u.username IS NOT NULL;

INSERT INTO "brand_space_member" (id, "brandSpaceId", "userId", role, "createdAt")
SELECT
  'legacy-space-member-' || u.id,
  'legacy-space-' || u.id,
  u.id,
  'owner',
  now()
FROM "user" u
WHERE u.username IS NOT NULL;

-- Point every personal-space post (brandSpaceId was null) at that new space.
UPDATE "space_post"
SET "brandSpaceId" = 'legacy-space-' || "userId"
WHERE "brandSpaceId" IS NULL;

-- AlterTable: now safe to require every post to belong to a real space.
ALTER TABLE "space_post" ALTER COLUMN "brandSpaceId" SET NOT NULL;

-- AlterTable: retire the personal-space fields on user — brand_space covers
-- this now, for every space including what used to be "My Space".
ALTER TABLE "user" DROP COLUMN "username";
ALTER TABLE "user" DROP COLUMN "bio";
ALTER TABLE "user" DROP COLUMN "backgroundImageKey";
ALTER TABLE "user" DROP COLUMN "showFollowerCount";
