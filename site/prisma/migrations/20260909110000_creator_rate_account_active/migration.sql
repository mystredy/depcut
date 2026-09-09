-- Rename first, then add the column — preserves the existing rows instead
-- of Prisma's own diff tool, which reads this rename as drop-and-recreate
-- and would silently lose them. Written directly rather than tool-generated
-- for that reason; review before running.
ALTER TABLE "creator_rate_account" RENAME TO "artist_rate_account";
ALTER TABLE "artist_rate_account" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;
