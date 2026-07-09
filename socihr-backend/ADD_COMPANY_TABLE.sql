-- ================================================================
-- ADD COMPANY FEATURE
-- Run this script in Supabase SQL Editor
-- 
-- NOTE: Tukar nama syarikat sebelum run jika perlu!
-- Default: Syarikat Alpha, Beta, Gamma, Delta
-- ================================================================

-- 1. Create Company table
CREATE TABLE IF NOT EXISTS "Company" (
    "CompanyID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "CompanyName" TEXT NOT NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Insert 4 companies (TUKAR NAMA DI SINI jika perlu)
INSERT INTO "Company" ("CompanyName") VALUES
    ('Syarikat Alpha'),
    ('Syarikat Beta'),
    ('Syarikat Gamma'),
    ('Syarikat Delta')
ON CONFLICT DO NOTHING;

-- 3. Add CompanyID column to Staff table (nullable for backward compat)
ALTER TABLE "Staff"
    ADD COLUMN IF NOT EXISTS "CompanyID" UUID NULL REFERENCES "Company"("CompanyID") ON DELETE SET NULL;

-- 4. Create SessionCompany junction table
--    (many-to-many: one session can involve multiple companies)
CREATE TABLE IF NOT EXISTS "SessionCompany" (
    "SessionCompanyID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "SessionID" UUID NOT NULL REFERENCES "MonitoringSession"("SessionID") ON DELETE CASCADE,
    "CompanyID" UUID NOT NULL REFERENCES "Company"("CompanyID") ON DELETE CASCADE,
    UNIQUE("SessionID", "CompanyID")
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_sessioncompany_sessionid" ON "SessionCompany"("SessionID");
CREATE INDEX IF NOT EXISTS "idx_sessioncompany_companyid" ON "SessionCompany"("CompanyID");
CREATE INDEX IF NOT EXISTS "idx_staff_companyid" ON "Staff"("CompanyID");

-- ================================================================
-- VERIFICATION: Run these to confirm everything is created
-- ================================================================
-- SELECT * FROM "Company";
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'Staff' AND column_name = 'CompanyID';
-- SELECT * FROM "SessionCompany" LIMIT 5;
