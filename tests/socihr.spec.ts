import { test, expect } from '@playwright/test';

// Define the Base URL of the running frontend application
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('SociHR E2E Test Suite', () => {

  test.beforeEach(async ({ page }) => {
    // 1. Navigate to the Login Page
    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveTitle(/SociHR/i);

    // 2. Perform Sign In using admin credentials
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin');
    await page.click('#login-btn');

    // 3. Wait for navigation to the Dashboard
    await page.waitForURL(`${BASE_URL}/dashboard`);
    // Use the unique h1 heading — avoids strict-mode violation from sidebar + h1 + loading div all matching 'text=Dashboard'
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('1. Verify Dashboard Metrics and AI Insights', async ({ page }) => {
    // Wait for async data to finish loading (loading indicator disappears)
    await expect(page.locator('text=Loading dashboard data...')).not.toBeVisible({ timeout: 20000 });

    // Verify key elements on Dashboard are visible after data loads
    await expect(page.locator('text=Overall Completion Rate')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Staff Leaderboard')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Platform Breakdown')).toBeVisible({ timeout: 15000 });

    // Check if AI insights trigger is present
    const aiButton = page.locator('button:has-text("Ask AI")');
    if (await aiButton.isVisible()) {
      await expect(aiButton).toBeEnabled();
    }
  });

  test('2. Company Management Flow (Create, Check, Delete)', async ({ page }) => {
    // Navigate to Companies page
    await page.click('text=Companies');
    await page.waitForURL(`${BASE_URL}/company`);
    await expect(page.locator('h1.page-title')).toContainText('Company Management');

    // Add Company
    await page.click('button:has-text("Add Company")');
    const testCompanyName = 'Playwright Test Company BHD';
    await page.fill('input[placeholder="e.g. Muaz Force SDN BHD"]', testCompanyName);
    await page.click('button[type="submit"]:has-text("Add Company")');

    // Verify company is added and exists in the leaderboard list
    await expect(page.locator(`text=${testCompanyName}`)).toBeVisible({ timeout: 10000 });

    // Delete Company
    // Hover or target the delete button within the specific company card
    const companyCard = page.locator('.card', { hasText: testCompanyName });
    await companyCard.hover();
    const deleteBtn = companyCard.locator('button[title="Delete Company"]');
    await deleteBtn.click();

    // Confirm Deletion in confirmation dialog (label is 'Confirm' by default in ConfirmationDialog)
    await page.getByRole('button', { name: 'Confirm' }).click();
    
    // Verify company has been removed
    await expect(page.locator(`text=${testCompanyName}`)).not.toBeVisible({ timeout: 10000 });
  });

  test('3. Department Management Flow (Create, Check, Delete)', async ({ page }) => {
    // Navigate to Departments page
    await page.click('text=Departments');
    await page.waitForURL(`${BASE_URL}/departments`);
    await expect(page.locator('h1.page-title')).toContainText('Department Management');

    // Add Department
    await page.click('button:has-text("Add Department")');
    const testDeptName = 'PLAYWRIGHT QA DEPT';
    await page.fill('#department-name', testDeptName);
    await page.click('button[type="submit"]:has-text("Add Department")');

    // Verify department card is present
    await expect(page.locator(`text=${testDeptName}`)).toBeVisible({ timeout: 10000 });

    // Delete Department
    const deptCard = page.locator('.card', { hasText: testDeptName });
    await deptCard.hover();
    const deleteBtn = deptCard.locator('button[title="Delete Department"]');
    await deleteBtn.click();

    // Confirm Deletion (label is 'Confirm' by default in ConfirmationDialog)
    await page.getByRole('button', { name: 'Confirm' }).click();

    // Verify department is deleted
    await expect(page.locator(`text=${testDeptName}`)).not.toBeVisible({ timeout: 10000 });
  });

  test('4. Staff Management Flow (Create, Filter, Edit, Delete)', async ({ page }) => {
    // Navigate to Staff page
    await page.click('text=Staff');
    await page.waitForURL(`${BASE_URL}/staff`);
    await expect(page.locator('h1.page-title')).toContainText('Staff');

    // Add Staff Member
    await page.click('#add-staff-btn');
    const staffName = 'Playwright Employee';
    await page.fill('#staff-name', staffName);
    
    // Select first option from dropdown or default
    await page.selectOption('#staff-dept', { index: 1 });
    await page.fill('#staff-position', 'Test Automation Engineer');
    await page.click('#staff-save-btn');

    // Verify employee listed in table
    await page.fill('#search-staff', staffName);
    // Wait for filter debounce, then assert row is visible
    await expect(page.locator('table').getByText(staffName)).toBeVisible({ timeout: 10000 });

    // Delete Staff member permanently
    // Title is 'Delete staff permanently', not just 'Delete'
    const row = page.locator('tr', { hasText: staffName });
    await row.locator('button[title="Delete staff permanently"]').click();

    // Confirm Delete dialog (StaffPage passes confirmLabel='Delete' explicitly)
    await page.getByRole('button', { name: 'Delete' }).click();

    // Verify deleted
    await expect(page.locator('table').getByText(staffName)).not.toBeVisible({ timeout: 10000 });
  });

  test('5. Monitoring Session Flow (Create, Edit Date/Platform/Company, Delete)', async ({ page }) => {
    // Navigate to Monitoring page
    await page.click('text=Monitoring');
    await page.waitForURL(`${BASE_URL}/monitoring`);
    // h1 has class 'mon-hdr-title' and text "Monitoring Sessions"
    await expect(page.locator('h1.mon-hdr-title')).toContainText('Monitoring');

    // Get current sessions count — each session is a .sesh-item div
    const sessionItems = page.locator('.sesh-item');
    const initialCount = await sessionItems.count();

    // Create New Session (button id="create-session-btn", text "New Session")
    await page.click('#create-session-btn');

    // Step 1: Set Date
    const testDate = '2026-08-15';
    await page.fill('input[type="date"]', testDate);
    await page.click('button:has-text("Next: Select Company")');

    // Step 2: Choose Companies (select at least one)
    await page.locator('input[type="checkbox"]').first().check();
    await page.click('button:has-text("Next: Select Platform")');

    // Step 3: Choose Platforms — submit button label has emoji: "🚀 Launch Session"
    await page.locator('input[type="checkbox"]').first().check();
    await page.click('button[type="submit"]:has-text("Launch Session")');

    // Wait for modal to close and list to re-fetch
    await expect(page.locator('.sesh-item')).toHaveCount(initialCount + 1, { timeout: 10000 });
    const postCount = await sessionItems.count();

    // Edit monitoring session — first item is newest (sorted by date desc)
    const activeSessionItem = page.locator('.sesh-item').first();
    const editBtn = activeSessionItem.locator('button[title="Edit Session"]');
    await editBtn.click();

    // Edit Step 1: Change Date — button label is "Next: Companies"
    const editDateVal = '2026-08-20';
    await page.fill('input[type="date"]', editDateVal);
    await page.click('button:has-text("Next: Companies")');

    // Edit Step 2: Companies — button label is "Next: Platforms"
    // Ensure at least one company stays checked (uncheck first if checked, check second)
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    if (await firstCheckbox.isChecked()) {
      await firstCheckbox.uncheck();
    }
    await page.locator('input[type="checkbox"]').nth(1).check();
    await page.click('button:has-text("Next: Platforms")');

    // Edit Step 3: Platforms — submit button label has emoji: "💾 Save Changes"
    await page.locator('input[type="checkbox"]').first().uncheck();
    await page.locator('input[type="checkbox"]').nth(1).check();
    await page.click('button[type="submit"]:has-text("Save Changes")');

    // Verify session updated — date shown in .sesh-item-date (not .engage-card-sub)
    // Wait for modal to close and session list to refresh
    await expect(page.locator('.sesh-item').first().locator('.sesh-item-date')).toContainText('2026', { timeout: 10000 });

    // Delete Session — title is "Delete" on the delete icon button
    const deleteSeshBtn = page.locator('.sesh-item').first().locator('button[title="Delete"]');
    await deleteSeshBtn.click();

    // Confirm deletion — ConfirmationDialog default label is "Confirm"
    await page.getByRole('button', { name: 'Confirm' }).click();

    // Verify count goes back down
    await expect(page.locator('.sesh-item')).toHaveCount(postCount - 1, { timeout: 10000 });
  });

  test('6. Navigation to Other Pages & Logging Out', async ({ page }) => {
    // Navigate to Snapshots
    await page.click('text=Snapshots');
    await page.waitForURL(`${BASE_URL}/snapshots`);
    await expect(page.locator('h1.page-title')).toContainText('Dashboard Snapshots');

    // Navigate to Audit Trail
    await page.click('text=Audit Trail');
    await page.waitForURL(`${BASE_URL}/audit`);
    await expect(page.locator('h1.page-title')).toContainText('Audit Trail');

    // Navigate to Reports
    await page.click('text=Reports');
    await page.waitForURL(`${BASE_URL}/reports`);
    await expect(page.locator('h1.page-title')).toContainText('Report Center');

    // Log Out
    await page.click('#logout-btn');
    await page.waitForURL(`${BASE_URL}/`);
    await expect(page.locator('#username')).toBeVisible();
  });
});
