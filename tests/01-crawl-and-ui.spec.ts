import { test, expect } from '@playwright/test';

test.describe('Site crawl and UI health', () => {
  test('TC-01: Homepage loads and internal links do not return 404/5xx', async ({ page, request }, testInfo) => {
    const serverErrors: string[] = [];
    const brokenLinks: string[] = [];
    const unusualClientErrors: string[] = [];

    page.on('response', response => {
      if (response.status() >= 500) {
        serverErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/WeVersity/i);

    const hrefs = await page.locator('a[href]').evaluateAll(anchors =>
      anchors.map(anchor => (anchor as HTMLAnchorElement).href)
    );

    const base = new URL(process.env.BASE_URL || 'https://weversity.org');
    const internalUrls = [...new Set(hrefs)]
      .filter(href => {
        try {
          const url = new URL(href);
          return (url.hostname === base.hostname || url.hostname === `www.${base.hostname}`)
            && !url.hash
            && !/logout|log-out|signout|wp-admin|wp-login/i.test(url.pathname);
        } catch {
          return false;
        }
      })
      .slice(0, 40);

    for (const url of internalUrls) {
      try {
        const response = await request.get(url, { timeout: 20_000 });
        if (response.status() === 404 || response.status() >= 500) {
          brokenLinks.push(`${response.status()} ${url}`);
        } else if (response.status() >= 400) {
          unusualClientErrors.push(`${response.status()} ${url}`);
        }
      } catch (error) {
        brokenLinks.push(`REQUEST FAILED ${url}: ${String(error)}`);
      }
    }

    if (unusualClientErrors.length) {
      await testInfo.attach('non-blocking-4xx-link-warnings.txt', {
        body: unusualClientErrors.join('\n'),
        contentType: 'text/plain',
      });
    }

    expect(brokenLinks, `Broken internal links:\n${brokenLinks.join('\n')}`).toEqual([]);
    expect(serverErrors, `Server errors during homepage load:\n${serverErrors.join('\n')}`).toEqual([]);
  });

  test('TC-02: Visible images load successfully', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    const brokenImages = await page.locator('img:visible').evaluateAll(images =>
      images
        .filter(image => {
          const img = image as HTMLImageElement;
          return img.complete && img.naturalWidth === 0;
        })
        .map(image => {
          const img = image as HTMLImageElement;
          return img.currentSrc || img.src || img.alt || 'Unidentified image';
        })
    );

    expect(brokenImages, `Broken visible images:\n${brokenImages.join('\n')}`).toEqual([]);
  });

  test('TC-03: Visible interactive controls have accessible labels', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const unlabeledControls = await page.locator('button:visible, [role="button"]:visible').evaluateAll(controls =>
      controls
        .filter(control => {
          const el = control as HTMLElement;
          const label = el.getAttribute('aria-label')
            || el.getAttribute('title')
            || el.innerText
            || (el as HTMLInputElement).value;
          return !label?.trim();
        })
        .map((control, index) => `Control #${index + 1}: ${(control as HTMLElement).outerHTML.slice(0, 180)}`)
    );

    expect(unlabeledControls, `Visible controls without an accessible label:\n${unlabeledControls.join('\n')}`).toEqual([]);
  });

  test('TC-04: Mobile layout has no horizontal overflow', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('Mobile'), 'Responsive overflow check runs in the mobile project only.');

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));

    expect(
      dimensions.content,
      `Horizontal overflow: content width ${dimensions.content}px exceeds viewport ${dimensions.viewport}px`
    ).toBeLessThanOrEqual(dimensions.viewport + 1);
  });

  test('TC-05: No uncaught JavaScript runtime errors on homepage', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', error => runtimeErrors.push(error.message));

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    expect(runtimeErrors, `Uncaught JavaScript errors:\n${runtimeErrors.join('\n')}`).toEqual([]);
  });
});
