-- Migration: Create DashboardSnapshot table
-- Run this SQL script in your PostgreSQL database

CREATE TABLE "DashboardSnapshot" (
    "SnapshotID" UUID PRIMARY KEY,
    "SnapshotName" VARCHAR(200) NOT NULL,
    "SnapshotDate" TIMESTAMP NOT NULL,
    "SnapshotData" TEXT NOT NULL,
    "CreatedBy" UUID NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    "Notes" TEXT
);

-- Create index for faster queries
CREATE INDEX "IX_DashboardSnapshot_SnapshotDate" ON "DashboardSnapshot" ("SnapshotDate" DESC);
CREATE INDEX "IX_DashboardSnapshot_CreatedBy" ON "DashboardSnapshot" ("CreatedBy");

-- Verify table creation
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'DashboardSnapshot';
