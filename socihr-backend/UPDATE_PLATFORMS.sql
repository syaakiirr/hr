-- =====================================================
-- UPDATE PLATFORMS - Keep Facebook, Instagram, TikTok only
-- =====================================================
-- Run this in Supabase SQL Editor to remove Twitter & LinkedIn
-- =====================================================

-- STEP 1: Delete audit trail records related to engagements from Twitter/LinkedIn posts
DELETE FROM "AuditTrail" 
WHERE "EngagementID" IN (
    SELECT "EngagementID" FROM "Engagement" 
    WHERE "PostID" IN (
        SELECT "PostID" FROM "SessionPost" 
        WHERE "PlatformID" IN (
            SELECT "PlatformID" FROM "Platform" 
            WHERE "PlatformName" IN ('Twitter', 'LinkedIn')
        )
    )
);

-- STEP 2: Delete engagements related to posts from Twitter/LinkedIn
DELETE FROM "Engagement" 
WHERE "PostID" IN (
    SELECT "PostID" FROM "SessionPost" 
    WHERE "PlatformID" IN (
        SELECT "PlatformID" FROM "Platform" 
        WHERE "PlatformName" IN ('Twitter', 'LinkedIn')
    )
);

-- STEP 3: Delete posts from Twitter/LinkedIn
DELETE FROM "SessionPost" 
WHERE "PlatformID" IN (
    SELECT "PlatformID" FROM "Platform" 
    WHERE "PlatformName" IN ('Twitter', 'LinkedIn')
);

-- STEP 4: Finally delete the platforms
DELETE FROM "Platform" 
WHERE "PlatformName" IN ('Twitter', 'LinkedIn');

-- =====================================================
-- VERIFY RESULTS
-- =====================================================

-- Check remaining platforms (should be 3)
SELECT 'Platforms' as table_name, COUNT(*) as count FROM "Platform"
UNION ALL
SELECT 'Posts', COUNT(*) FROM "SessionPost"
UNION ALL
SELECT 'Engagements', COUNT(*) FROM "Engagement"
UNION ALL
SELECT 'AuditTrail', COUNT(*) FROM "AuditTrail";

-- Check platform distribution
SELECT 
    p."PlatformName",
    COUNT(DISTINCT sp."PostID") as "TotalPosts",
    COUNT(DISTINCT e."EngagementID") as "TotalEngagements"
FROM "Platform" p
LEFT JOIN "SessionPost" sp ON p."PlatformID" = sp."PlatformID"
LEFT JOIN "Engagement" e ON sp."PostID" = e."PostID"
GROUP BY p."PlatformName"
ORDER BY p."PlatformName";

-- =====================================================
-- Expected result: Only 3 platforms
-- - Facebook
-- - Instagram  
-- - TikTok
-- =====================================================
