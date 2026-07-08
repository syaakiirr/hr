-- ============================================
-- DROP ALL TABLES (COMPLETE DATABASE RESET)
-- ============================================
-- WARNING: This will DELETE ALL TABLES and DATA
-- Use this ONLY if you want to completely reset and recreate the database
-- Run this in Supabase SQL Editor

-- Drop tables in correct order (reverse of creation)
DROP TABLE IF EXISTS "AuditTrail" CASCADE;
DROP TABLE IF EXISTS "Engagement" CASCADE;
DROP TABLE IF EXISTS "SessionPost" CASCADE;
DROP TABLE IF EXISTS "MonitoringSession" CASCADE;
DROP TABLE IF EXISTS "DashboardSnapshot" CASCADE;
DROP TABLE IF EXISTS "Staff" CASCADE;
DROP TABLE IF EXISTS "Platform" CASCADE;
DROP TABLE IF EXISTS "AppUser" CASCADE;

-- Drop any remaining sequences
DROP SEQUENCE IF EXISTS engagement_id_seq CASCADE;
DROP SEQUENCE IF EXISTS staff_id_seq CASCADE;
DROP SEQUENCE IF EXISTS monitoring_session_id_seq CASCADE;

-- Verify all tables are dropped
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';

-- Success message
SELECT '✅ All tables dropped! Database is now empty.' as status;
SELECT '⚠️ You need to recreate tables using CREATE_TABLES.sql or Entity Framework migrations.' as next_step;
