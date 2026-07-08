-- Migration: Add archive columns to Staff and MonitoringSession tables
-- Run this SQL script in your PostgreSQL database

-- Add archive columns to Staff table
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "IsArchived" BOOLEAN DEFAULT FALSE;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "ArchivedBy" UUID;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "ArchivedAt" TIMESTAMP;

-- Add archive columns to MonitoringSession table
ALTER TABLE "MonitoringSession" ADD COLUMN IF NOT EXISTS "IsArchived" BOOLEAN DEFAULT FALSE;
ALTER TABLE "MonitoringSession" ADD COLUMN IF NOT EXISTS "ArchivedBy" UUID;
ALTER TABLE "MonitoringSession" ADD COLUMN IF NOT EXISTS "ArchivedAt" TIMESTAMP;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS "IX_Staff_IsArchived" ON "Staff" ("IsArchived");
CREATE INDEX IF NOT EXISTS "IX_MonitoringSession_IsArchived" ON "MonitoringSession" ("IsArchived");

-- Update existing records to set IsArchived = FALSE (if NULL)
UPDATE "Staff" SET "IsArchived" = FALSE WHERE "IsArchived" IS NULL;
UPDATE "MonitoringSession" SET "IsArchived" = FALSE WHERE "IsArchived" IS NULL;

-- Verify changes
SELECT 'Staff columns:' as info;
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'Staff' AND column_name LIKE '%Archive%';

SELECT 'MonitoringSession columns:' as info;
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'MonitoringSession' AND column_name LIKE '%Archive%';
