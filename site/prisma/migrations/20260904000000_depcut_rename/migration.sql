-- The product renamed from Donkey Cut to DepCut. AppSettings.appName's
-- column default was 'Depcut' (a casing typo from an earlier, informal
-- pass at this same rename) — fix the default going forward, and fix any
-- row that already carries that literal value so an admin who never
-- touched the site name field doesn't keep showing the old casing.
-- Idempotent: safe to re-run from any state.

ALTER TABLE "app_settings" ALTER COLUMN "appName" SET DEFAULT 'DepCut';

UPDATE "app_settings" SET "appName" = 'DepCut' WHERE "appName" = 'Depcut';
