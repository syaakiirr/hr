-- ============================================================
-- Migration: Add DeptAdmin support
-- Run this on your PostgreSQL database
-- ============================================================

-- 1. Add DepartmentID column to Users table (nullable)
ALTER TABLE "Users"
ADD COLUMN IF NOT EXISTS "DepartmentID" UUID REFERENCES "Department"("DepartmentID") ON DELETE SET NULL;

-- 2. Rename existing "Admin" role to "SuperAdmin"
UPDATE "Users" SET "Role" = 'SuperAdmin' WHERE "Role" = 'Admin';

-- 3. (Optional) Verify
SELECT "Username", "Role", "DepartmentID" FROM "Users";
