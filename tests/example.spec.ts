import { test, expect } from '@playwright/test';

test.describe('WeVersity Pro E2E Health & UI Check', () => {

  test('1. Homepage load aur title check', async ({ page }) => {
    await page.goto('https://weversity.org', { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle(/WeVersity/i);
  });

  test('2. Console errors check (Koi red JS error toh nahi)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('https://weversity.org');
    expect(errors).toEqual([]);
  });

  test('3. Navigation aur Login/Signup links check', async ({ page }) => {
    await page.goto('https://weversity.org');
    
    const header = page.locator('header, nav').first();
    await expect(header).toBeVisible();

    const loginLink = page.getByRole('link', { name: /login|sign in/i }).first();
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/login|signin|auth/i);
    }
  });

  test('4. Mobile Responsiveness (Horizontal overflow check)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('https://weversity.org');

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

});