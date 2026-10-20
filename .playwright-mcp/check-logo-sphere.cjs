const { chromium, expect: baseExpect } = require('@playwright/test');
const expect = baseExpect.configure({ timeout: 30000 });
(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5174/logo-sphere', { waitUntil: 'networkidle' });
  await expect(page.locator('.logo-sphere-canvas canvas')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.logo-sphere-status')).toHaveCount(0, { timeout: 20000 });
  await expect(page.locator('.logo-sphere-error')).toHaveCount(0);
  await page.screenshot({ path: '.playwright-mcp/logo-sphere-desktop.png', fullPage: true });
  await page.locator('input[type=file]').setInputFiles([
    { name: 'wide.png', mimeType: 'image/png', buffer: await page.locator('.sphere-studio__brand img').screenshot() },
    { name: 'second.png', mimeType: 'image/png', buffer: await page.locator('.sphere-studio__brand img').screenshot() },
  ]);
  await expect(page.locator('.sphere-logo-list > div')).toHaveCount(13);
  await page.getByLabel('Remove wide', { exact: true }).click();
  await expect(page.locator('.sphere-logo-list > div')).toHaveCount(12);
  await page.getByLabel('Arrangement').selectOption('rings');
  await page.getByLabel('Logo count', { exact: false }).fill('60');
  await page.getByLabel('Field of view', { exact: false }).fill('48');
  await page.getByLabel('Pause rotation', { exact: true }).click();
  await expect(page.getByLabel('Automatic rotation', { exact: true })).not.toBeChecked();
  const canvas = page.locator('.logo-sphere-canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 12 }); await page.mouse.up();
  await canvas.focus(); await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Use on my landing page', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('socihr.stack-sphere.v2')));
  expect(saved.logos).toHaveLength(12); expect(saved.settings.count).toBe(60); expect(saved.settings.layout).toBe('rings');
  await page.getByRole('link', { name: 'Landing page', exact: true }).click();
  await expect(page.locator('.landing-logo-sphere canvas')).toBeVisible();
  await expect(page.locator('#top .hero-orbit')).toHaveCount(1);
  await expect(page.locator('#top .landing-logo-sphere')).toHaveCount(0);
  await expect(page.locator('.landing-stack .landing-logo-sphere')).toHaveCount(1);
  await page.locator('.landing-stack').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.playwright-mcp/logo-sphere-landing.png' });
  await page.getByRole('link', { name: 'Customise sphere' }).click();
  await expect(page.locator('.sphere-logo-list > div')).toHaveCount(12);
  await page.getByRole('button', { name: 'Reset all', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: '.playwright-mcp/logo-sphere-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('input[type=file]').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
  await expect(page.locator('.sphere-studio__save [role=status]')).toContainText('use PNG');
  const geometry = await page.evaluate(async () => {
    const { curvedLogoGeometry } = await import('/src/components/logo-sphere/LogoSphere.tsx');
    const g = curvedLogoGeometry(.6, 1.525);
    const p = g.getAttribute('position');
    let error = 0, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < p.count; i++) {
      error = Math.max(error, Math.abs(Math.hypot(p.getX(i), p.getY(i), p.getZ(i)) - 1.525));
      minZ = Math.min(minZ, p.getZ(i)); maxZ = Math.max(maxZ, p.getZ(i));
    }
    g.dispose(); return { error, curvature: maxZ - minZ };
  });
  expect(geometry.error).toBeLessThan(.000001);
  expect(geometry.curvature).toBeGreaterThan(.01);
  expect(errors).toEqual([]);
  console.log('PASS: rendering, multiple uploads, removal, settings, drag/keyboard, pause, save/reload, reset, invalid file, mobile overflow; no browser errors.');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });

