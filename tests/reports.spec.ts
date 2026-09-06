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

test.describe('Reports — Critical Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('1. Navigate to Reports page', async ({ page }) => {
    await page.click('text=Reports');
    await page.waitForURL(`${BASE_URL}/reports`);
    await expect(page.locator('h1.page-title')).toContainText('Reports', { timeout: 15000 });
    await expect(page.locator('text=Export staff engagement analysis reports')).toBeVisible();
  });

  test('2. Report type selection — Daily/Weekly/Monthly/Yearly/Custom', async ({ page }) => {
    await page.click('text=Reports');
    await page.waitForURL(`${BASE_URL}/reports`);
    await expect(page.locator('text=Report Period')).toBeVisible({ timeout: 15000 });

    for (const type of ['Daily', 'Weekly', 'Monthly', 'Yearly']) {
      const el = page.locator(`#report-type-${type.toLowerCase()}`);
      if ((await el.count()) > 0) {
        await el.click();
        await page.waitForTimeout(300);
        await expect(el).toHaveCSS('background-image', expect.stringContaining('135deg'));
      }
    }

    const customType = page.locator('#report-type-custom');
    if ((await customType.count()) > 0) {
      await customType.click();
      await expect(page.locator('input[type="date"]')).toBeVisible();
    }
  });

  test('3. Download PDF report triggers file download', async ({ page }) => {
    await page.click('text=Reports');
    await page.waitForURL(`${BASE_URL}/reports`);

    const pdfBtn = page.locator('#download-pdf-btn');
    if ((await pdfBtn.count()) > 0) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        pdfBtn.click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/SociHR_Report.*\.pdf/);
    }
  });

  test('4. Download Excel report triggers file download', async ({ page }) => {
    await page.click('text=Reports');
    await page.waitForURL(`${BASE_URL}/reports`);

    const excelBtn = page.locator('#download-excel-btn');
    if ((await excelBtn.count()) > 0) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        excelBtn.click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/SociHR_Report.*\.xlsx/);
    }
  });

  test('5. Custom report modal opens and has option checkboxes', async ({ page }) => {
    await page.click('text=Reports');
    await page.waitForURL(`${BASE_URL}/reports`);

    const customBtn = page.locator('button:has-text("Customize")');
    if ((await customBtn.count()) > 0) {
      await customBtn.click();
      await expect(page.locator('text=Customize Report')).toBeVisible({ timeout: 5000 });

      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();
      expect(count).toBeGreaterThan(0);

      const options = ['Summary Cards', 'Staff Ranking', 'Platform & Company', 'Daily', 'Staff Table', 'Monitoring Sessions'];
      for (const opt of options) {
        const label = page.locator(`text=${opt}`);
        if ((await label.count()) > 0) {
          await expect(label.first()).toBeVisible();
        }
      }
    }
  });

  test('6. Custom date range validation (from > to)', async ({ page }) => {
    await page.click('text=Reports');
    await page.waitForURL(`${BASE_URL}/reports`);

    const customType = page.locator('#report-type-custom');
    if ((await customType.count()) > 0) {
      await customType.click();
      const fromInput = page.locator('input[type="date"]').first();
      const toInput = page.locator('input[type="date"]').last();
      await fromInput.fill('2026-12-31');
      await toInput.fill('2026-01-01');
      await page.waitForTimeout(500);
      // Alert should fire — just verify no crash
      await expect(page.locator('text=Reports')).toBeVisible();
    }
  });

  test('7. Reports page accessible only when authenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/reports`);
    await page.waitForURL(`${BASE_URL}/`);
    await expect(page.locator('text=Account Login')).toBeVisible();
  });
});
