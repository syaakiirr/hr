-- QUICK FIX: Add archive columns
-- Copy and paste this into Supabase SQL Editor and run it

ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "IsArchived" BOOLEAN DEFAULT FALSE;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "ArchivedBy" UUID;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "ArchivedAt" TIMESTAMP;

ALTER TABLE "MonitoringSession" ADD COLUMN IF NOT EXISTS "IsArchived" BOOLEAN DEFAULT FALSE;
ALTER TABLE "MonitoringSession" ADD COLUMN IF NOT EXISTS "ArchivedBy" UUID;
ALTER TABLE "MonitoringSession" ADD COLUMN IF NOT EXISTS "ArchivedAt" TIMESTAMP;

CREATE INDEX IF NOT EXISTS "IX_Staff_IsArchived" ON "Staff" ("IsArchived");
CREATE INDEX IF NOT EXISTS "IX_MonitoringSession_IsArchived" ON "MonitoringSession" ("IsArchived");

UPDATE "Staff" SET "IsArchived" = FALSE WHERE "IsArchived" IS NULL;
UPDATE "MonitoringSession" SET "IsArchived" = FALSE WHERE "IsArchived" IS NULL;
