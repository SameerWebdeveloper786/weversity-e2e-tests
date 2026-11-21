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

    // The current WeVersity header points directly to /login.
    const response = await page.goto('/login', { waitUntil: 'domcontentloaded' });
    expect(response?.status(), 'WeVersity login page did not load successfully').toBeLessThan(400);

    const emailInput = page.getByRole('textbox', { name: /^email address$/i });
    const passwordInput = page.getByRole('textbox', { name: /^password$/i });
    const signInButton = page.getByRole('button', { name: /^sign in$/i });

    await expect(emailInput, 'Email Address field was not visible on /login').toBeVisible();
    await expect(passwordInput, 'Password field was not visible on /login').toBeVisible();
    await expect(signInButton, 'Sign In button was not visible on /login').toBeVisible();

    await emailInput.fill(email!);
    await passwordInput.fill(password!);
    await signInButton.click();

    // Capture WeVersity's CAPTCHA verification response. A 403 is an
    // explicit production anti-bot rejection, not a bad-password result.
    let captchaRejected = false;
    page.on('response', response => {
      const url = new URL(response.url());
      if (
        url.hostname === 'verify-captcha.weversity.org' &&
        url.pathname === '/api' &&
        response.status() === 403
      ) {
        captchaRejected = true;
      }
    });

    const continueWithoutLocation = page
      .getByRole('dialog')
      .getByRole('button', { name: /continue without location/i });

    // The successful flow can display an optional location dialog. Wait for
    // either that dialog, a CAPTCHA rejection, or an authenticated state.
    const authenticatedNavigation = page
      .locator('a:visible, button:visible, [role="menuitem"]:visible')
      .filter({
        hasText: /^(dashboard|student dashboard|my dashboard|my courses|my learning|profile|my profile|account|my account|log out|logout|sign out)$/i,
      })
      .first();

    await expect.poll(async () => {
      const pathname = new URL(page.url()).pathname;
      const authenticatedRoute = /\/(dashboard|student-dashboard|my-courses|my-learning|profile|account|student)(\/|$)/i.test(pathname);
      const locationPromptVisible = await continueWithoutLocation.isVisible().catch(() => false);
      const authenticatedControlVisible = await authenticatedNavigation.isVisible().catch(() => false);
      return captchaRejected || locationPromptVisible || authenticatedRoute || authenticatedControlVisible;
    }, {
      timeout: 20_000,
      message: 'After Sign In, neither WeVersity CAPTCHA verification, the optional location step, nor an authenticated account state appeared',
    }).toBe(true);

    if (captchaRejected) {
      test.skip(
        true,
        'WeVersity production CAPTCHA endpoint returned HTTP 403 for automated sign-in. This is anti-bot protection, not an invalid QA credential. Use staging with an approved QA CAPTCHA configuration.'
      );
    }

    if (await continueWithoutLocation.isVisible().catch(() => false)) {
      // This permission is optional; continue without sharing geolocation.
      await continueWithoutLocation.click();
    }

    // Check visible authenticated UI or a known account route. Do not inspect
    // body text because hidden login-panel content can produce false matches.
    const authenticatedNavigation = page
      .locator('a:visible, button:visible, [role="menuitem"]:visible')
      .filter({
        hasText: /^(dashboard|student dashboard|my dashboard|my courses|my learning|profile|my profile|account|my account|log out|logout|sign out)$/i,
      })
      .first();

    await expect.poll(async () => {
      const pathname = new URL(page.url()).pathname;
      const authenticatedRoute = /\/(dashboard|student-dashboard|my-courses|my-learning|profile|account|student)(\/|$)/i.test(pathname);
      const visibleAccountControl = await authenticatedNavigation.isVisible().catch(() => false);
      return authenticatedRoute || visibleAccountControl;
    }, {
      timeout: 30_000,
      message: 'Sign In was submitted, but no visible authenticated account navigation or account route appeared. Check the on-page login error before treating this as a credential issue.',
    }).toBe(true);
  });
});
