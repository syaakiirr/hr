-- ================================================================
-- ADD POSITION COLUMN TO STAFF TABLE
-- Run this in your Supabase SQL Editor
-- ================================================================

ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "Position" TEXT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Staff' AND column_name = 'Position';
