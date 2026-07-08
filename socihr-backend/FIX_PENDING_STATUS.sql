-- =====================================================
-- FIX PENDING STATUS - Change to Missed
-- =====================================================
-- Run this in Supabase SQL Editor
-- =====================================================

-- Check current status distribution
SELECT 
    "Status",
    COUNT(*) as "Count"
FROM "Engagement"
GROUP BY "Status"
ORDER BY "Status";

-- Update all "Pending" to "Missed"
UPDATE "Engagement"
SET "Status" = 'Missed'
WHERE "Status" = 'Pending';

-- Verify after update (should only show Completed & Missed)
SELECT 
    "Status",
    COUNT(*) as "Count"
FROM "Engagement"
GROUP BY "Status"
ORDER BY "Status";

-- =====================================================
-- Expected result: Only 2 statuses
-- - Completed
-- - Missed
-- =====================================================
