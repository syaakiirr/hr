-- ================================================================
-- ADD ENGAGEMENT SUB-ACTIONS & REASON
-- Run this script in Supabase SQL Editor
-- ================================================================

ALTER TABLE "Engagement"
  ADD COLUMN IF NOT EXISTS "IsLiked"     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "IsCommented" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "IsShared"    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "Reason"      TEXT NULL;
