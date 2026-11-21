import { test, expect } from '@playwright/test';

test.describe('Authentication and student journey', () => {
  test('TC-06: Student registration page exposes a usable form and required fields', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('Mobile'), 'Registration form structure is checked in the desktop project.');

    const response = await page.goto('/student-registration/', { waitUntil: 'domcontentloaded' });
    expect(response?.status(), 'Registration page did not return a successful response').toBeLessThan(400);

    const form = page.locator('form').first();
    await expect(form, 'No registration form was found on /student-registration/').toBeVisible();

    const fields = form.locator('input, select, textarea');
    expect(await fields.count(), 'Registration form has no input fields').toBeGreaterThan(0);

    const requiredCount = await fields.evaluateAll(elements =>
      elements.filter(element => (element as HTMLInputElement).required).length
    );
    expect(requiredCount, 'Registration form has no browser-enforced required fields').toBeGreaterThan(0);
  });

  test('TC-07: Login form validates malformed email before submission', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('Mobile'), 'Authentication form validation is checked in the desktop project.');

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const loginLink = page.getByRole('link', { name: /log in|login|sign in/i }).first();
    await expect(loginLink, 'A visible Login/Sign in link was not found').toBeVisible();
    await loginLink.click();

    const email = page.locator('input[type="email"]').first();
    const password = page.locator('input[type="password"]').first();
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();

    await email.fill('not-a-valid-email');
    await password.fill('QA-Validation-Only');
    const browserValidity = await email.evaluate(input => (input as HTMLInputElement).checkValidity());
    expect(browserValidity, 'Malformed email is accepted by native email validation').toBe(false);
  });

  test('TC-08: Dedicated QA student can sign in and reach an authenticated area', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('Mobile'), 'Real account sign-in is run once in the desktop project.');

    const email = process.env.QA_STUDENT_EMAIL;
    const password = process.env.QA_STUDENT_PASSWORD;

    test.skip(!email || !password, 'Not run: configure QA_STUDENT_EMAIL and QA_STUDENT_PASSWORD repository secrets to enable the real student journey.');

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const loginLink = page.getByRole('link', { name: /log in|login|sign in/i }).first();
    await expect(loginLink, 'A visible Login/Sign in link was not found').toBeVisible();
    await loginLink.click();

    await page.locator('input[type="email"]').first().fill(email!);
    await page.locator('input[type="password"]').first().fill(password!);
    await page.locator('button[type="submit"], input[type="submit"]').first().click();

    await expect(
      page.locator('body'),
      'Login completed without an authenticated dashboard/profile indicator'
    ).toContainText(/dashboard|my courses|logout|log out|sign out|profile/i, { timeout: 25_000 });
  });
});
