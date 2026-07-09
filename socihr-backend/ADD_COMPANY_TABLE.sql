-- ================================================================
-- ADD COMPANY FEATURE (UPDATED)
-- Run this script in Supabase SQL Editor
-- 
-- NOTE: Tukar nama syarikat sebelum run jika perlu!
-- ================================================================

-- 1. Create Company table
CREATE TABLE IF NOT EXISTS "Company" (
    "CompanyID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "CompanyName" TEXT NOT NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Insert 4 companies
INSERT INTO "Company" ("CompanyName") VALUES
    ('Syarikat Alpha'),
    ('Syarikat Beta'),
    ('Syarikat Gamma'),
    ('Syarikat Delta')
ON CONFLICT DO NOTHING;

-- 3. Add CompanyID column to SessionPost table (each post belongs to a company)
ALTER TABLE "SessionPost"
    ADD COLUMN IF NOT EXISTS "CompanyID" UUID NULL REFERENCES "Company"("CompanyID") ON DELETE SET NULL;

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS "idx_sessionpost_companyid" ON "SessionPost"("CompanyID");
