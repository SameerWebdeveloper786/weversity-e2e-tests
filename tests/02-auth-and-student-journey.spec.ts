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
    test.skip(!email || !password, 'Not run: configure QA_STUDENT_EMAIL and QA_STUDENT_PASSWORD repository secrets.');

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // WeVersity opens the sign-in panel from the header; scope the fields to
    // the form that actually contains the email and password controls.
    const signInLink = page.getByRole('link', { name: /^(sign in|log in|login)$/i }).first();
    await expect(signInLink, 'WeVersity header sign-in link was not visible').toBeVisible();
    await signInLink.click();

    const signInForm = page.locator('form').filter({
      has: page.locator('input[type="email"]'),
    }).filter({
      has: page.locator('input[type="password"]'),
    }).first();

    await expect(signInForm, 'Sign-in form with email and password fields did not open').toBeVisible();

    const emailInput = signInForm.locator('input[type="email"]').first();
    const passwordInput = signInForm.locator('input[type="password"]').first();
    await emailInput.fill(email!);
    await passwordInput.fill(password!);

    // Use the visible WeVersity "Sign In" action instead of assuming that
    // the first submit control on the page belongs to the login form.
    const signInButton = signInForm.getByRole('button', { name: /^sign in$/i });
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    } else {
      await signInForm.locator('button[type="submit"], input[type="submit"]').first().click();
    }

    // A successful sign-in may show WeVersity's optional location-permission
    // step. It is not required for authentication, so continue without it.
    const continueWithoutLocation = page
      .locator('button, a, [role="button"]')
      .filter({ hasText: /continue without location/i })
      .first();

    if (await continueWithoutLocation.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await continueWithoutLocation.click();
    }

    // The sign-in panel can remain mounted in the DOM while hidden. Check
    // visible account navigation or a known authenticated route, not body
    // text (which also includes hidden modal content).
    const authenticatedNavigation = page
      .locator('a:visible, button:visible, [role="menuitem"]:visible')
      .filter({ hasText: /^(dashboard|my courses|my learning|profile|account|log out|logout|sign out)$/i })
      .first();

    await expect.poll(async () => {
      const pathname = new URL(page.url()).pathname;
      const authenticatedRoute = /\/(dashboard|student-dashboard|my-courses|my-learning|profile|account)(\/|$)/i.test(pathname);
      const visibleAccountControl = await authenticatedNavigation.isVisible().catch(() => false);
      return authenticatedRoute || visibleAccountControl;
    }, {
      timeout: 30_000,
      message: 'Sign-in did not reach a visible authenticated account area after handling the optional location step',
    }).toBe(true);
  });
});
