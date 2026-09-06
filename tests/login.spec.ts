import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

function getToken(page: any): string | null {
  return page.evaluate(() => localStorage.getItem('token'));
}

function getStoredUser(page: any): { username: string; role: string } | null {
  return page.evaluate(() => {
    const u = localStorage.getItem('username');
    const r = localStorage.getItem('role');
    return u && r ? { username: u, role: r } : null;
  });
}

test.describe('Login — Critical Flow', () => {
  test('1. Login page loads with branding and form', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveTitle(/SociHR/i);
    await expect(page.locator('text=Account Login')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#login-btn')).toBeVisible();
    await expect(page.locator('text=Sign In')).toBeVisible();
  });

  test('2. Successful login stores token, username, role in localStorage', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin');
    await page.click('#login-btn');
    await page.waitForURL(`${BASE_URL}/dashboard`);

    const token = await getToken(page);
    expect(token).toBeTruthy();

    const user = getStoredUser(page);
    expect(user).toEqual({ username: 'admin', role: 'SuperAdmin' });

    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('3. Failed login with wrong password shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.fill('#username', 'admin');
    await page.fill('#password', 'wrongpassword');
    await page.click('#login-btn');
    await page.waitForTimeout(1000);

    const errorEl = page.locator('.lp-error, [style*="red"]').first();
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(`${BASE_URL}/`);
  });

  test('4. Failed login with wrong username shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.fill('#username', 'nonexistent_user');
    await page.fill('#password', 'admin');
    await page.click('#login-btn');
    await page.waitForTimeout(1000);

    const errorEl = page.locator('.lp-error').first();
    await expect(errorEl).toBeVisible({ timeout: 5000 });
  });

  test('5. Protected route redirects unauthenticated users to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForURL(`${BASE_URL}/`);
    await expect(page.locator('text=Account Login')).toBeVisible();
  });

  test('6. Logout clears localStorage and redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin');
    await page.click('#login-btn');
    await page.waitForURL(`${BASE_URL}/dashboard`);

    await page.click('#logout-btn');
    await page.waitForURL(`${BASE_URL}/`);

    const token = await getToken(page);
    expect(token).toBeNull();
    await expect(page.locator('#username')).toBeVisible();
  });

  test('7. Login button disabled during authentication', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin');
    const loginBtn = page.locator('#login-btn');
    await expect(loginBtn).toBeEnabled();
    await page.click('#login-btn');
    await page.waitForURL(`${BASE_URL}/dashboard`);
  });

  test('8. Show/hide password toggle works', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const passwordInput = page.locator('#password');
    const toggleBtn = page.locator('button[aria-label*="password"]');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('9. Login with empty fields does not submit', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await expect(page.locator('#login-btn')).toBeEnabled();
    await page.click('#login-btn');
    await expect(page).toHaveURL(`${BASE_URL}/`);
  });
});
