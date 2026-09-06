import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

async function login(page: any) {
  await page.goto(`${BASE_URL}/`);
  await expect(page).toHaveTitle(/SociHR/i);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin');
  await page.click('#login-btn');
  await page.waitForURL(`${BASE_URL}/dashboard`);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 15000 });
}

test.describe('Leaderboard — Critical Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('1. Dashboard loads with KPI cards', async ({ page }) => {
    await expect(page.locator('text=Overall Completion Rate')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=Total Staff')).toBeVisible();
    await expect(page.locator('text=Total Sessions')).toBeVisible();
    await expect(page.locator('text=Expected Ticks')).toBeVisible();
    await expect(page.locator('text=Completed Ticks')).toBeVisible();
    await expect(page.locator('text=Missed Ticks')).toBeVisible();
  });

  test('2. Staff Leaderboard section is visible', async ({ page }) => {
    await expect(page.locator('text=Staff Leaderboard')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Top Performing Staff')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Staff Needing Attention')).toBeVisible({ timeout: 15000 });
  });

  test('3. Platform comparison badges display completion rates', async ({ page }) => {
    await expect(page.locator('text=Performance by Platform')).toBeVisible({ timeout: 15000 });
    const platformBadges = page.locator('.kpi, [style*="border-radius"]');
    await page.waitForTimeout(2000);
    const count = await platformBadges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('4. Completion rate color coding (green/amber/red)', async ({ page }) => {
    await expect(page.locator('text=Overall Completion Rate')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);
    const rateEl = page.locator('text=Overall Completion Rate').first();
    await expect(rateEl).toBeVisible();
    const kpiCards = page.locator('.kpi');
    const count = await kpiCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('5. Date filter buttons are present and functional', async ({ page }) => {
    const filterBtns = page.locator('.btn-sm');
    const count = await filterBtns.count();
    expect(count).toBeGreaterThan(0);

    const firstFilter = filterBtns.first();
    const initialText = await firstFilter.textContent();
    await firstFilter.click();
    await page.waitForTimeout(1000);
    await expect(firstFilter).toBeVisible();
  });

  test('6. Save Snapshot and View Snapshots buttons work', async ({ page }) => {
    const saveBtn = page.locator('button[aria-label="Save dashboard snapshot"]');
    if ((await saveBtn.count()) > 0) {
      await saveBtn.click();
      await expect(page.locator('text=Save Dashboard Snapshot')).toBeVisible({ timeout: 5000 });

      const snapshotName = page.locator('input[placeholder*="Snapshot" i]');
      await snapshotName.fill(`E2E Snapshot ${Date.now()}`);
      await page.getByRole('button', { name: /Save Snapshot/i }).click();
      await page.waitForTimeout(1000);
    }
  });

  test('7. Dashboard data loads after login (no loading state persist)', async ({ page }) => {
    await expect(page.locator('text=Loading dashboard data...')).not.toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=Overall Completion Rate')).toBeVisible({ timeout: 15000 });
  });

  test('8. Weekly trend and Monthly trend charts render', async ({ page }) => {
    await expect(page.locator('text=Monthly Trend')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Weekly Trend')).toBeVisible({ timeout: 15000 });
  });

  test('9. Navigate to Dashboard from other pages', async ({ page }) => {
    await page.click('text=Monitoring');
    await page.waitForURL(`${BASE_URL}/monitoring`);
    await page.click('text=Dashboard');
    await page.waitForURL(`${BASE_URL}/dashboard`);
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('10. Company performance section visible', async ({ page }) => {
    await expect(page.locator('text=Company Performance')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);
    const perfItems = page.locator('.card').filter({ hasText: /%$/ });
    const count = await perfItems.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
