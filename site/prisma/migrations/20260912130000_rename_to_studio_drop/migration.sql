-- Rename to match DepCut's own vocabulary — Studio (connected account
-- type) and Drop (publishing type), same as YouTube's Channel/Shorts or
-- TikTok's Profile/Posts. Same tables and rows, new names; run after
-- 20260912120000_retire_personal_space, which this depends on.
ALTER TABLE "brand_space" RENAME TO "studio";
ALTER TABLE "brand_space_member" RENAME TO "studio_member";
ALTER TABLE "brand_space_invite" RENAME TO "studio_invite";
ALTER TABLE "brand_space_activity" RENAME TO "studio_activity";
ALTER TABLE "space_post" RENAME TO "drop";

ALTER TABLE "studio_member" RENAME COLUMN "brandSpaceId" TO "studioId";
ALTER TABLE "studio_invite" RENAME COLUMN "brandSpaceId" TO "studioId";
ALTER TABLE "studio_activity" RENAME COLUMN "brandSpaceId" TO "studioId";
ALTER TABLE "drop" RENAME COLUMN "brandSpaceId" TO "studioId";
ALTER TABLE "social_connection" RENAME COLUMN "brandSpaceId" TO "studioId";
