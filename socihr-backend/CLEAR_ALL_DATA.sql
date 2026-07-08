-- ============================================
-- CLEAR ALL DATA FROM DATABASE
-- ============================================
-- WARNING: This will delete ALL data but keep table structure
-- Run this in Supabase SQL Editor

-- Delete data in correct order to respect foreign key constraints

-- 1. Delete audit trail (references Engagement)
DELETE FROM "AuditTrail";

-- 2. Delete engagements (references MonitoringSession, Staff, SessionPost)
DELETE FROM "Engagement";

-- 3. Delete session posts (references MonitoringSession and Platform)
DELETE FROM "SessionPost";

-- 4. Delete monitoring sessions (references Users)
DELETE FROM "MonitoringSession";

-- 5. Delete staff
DELETE FROM "Staff";

-- 6. Delete platforms
DELETE FROM "Platform";

-- 7. Delete users EXCEPT admin (to preserve login access)
DELETE FROM "Users" WHERE "Username" != 'admin';

-- Verify deletion - check remaining rows
SELECT 'AuditTrail' as table_name, COUNT(*) as remaining_rows FROM "AuditTrail"
UNION ALL
SELECT 'Engagement', COUNT(*) FROM "Engagement"
UNION ALL
SELECT 'SessionPost', COUNT(*) FROM "SessionPost"
UNION ALL
SELECT 'MonitoringSession', COUNT(*) FROM "MonitoringSession"
UNION ALL
SELECT 'Staff', COUNT(*) FROM "Staff"
UNION ALL
SELECT 'Platform', COUNT(*) FROM "Platform"
UNION ALL
SELECT 'Users', COUNT(*) FROM "Users";

-- Success message
SELECT '✅ All dummy data cleared successfully! Admin user preserved.' as status;
