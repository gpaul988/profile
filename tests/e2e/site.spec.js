const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.location.origin !== 'null') {
      window.sessionStorage.setItem('graham-welcome-offer-state', 'dismissed');
    }
  });
  await page.route('https://**/*', (route) => route.abort());
});

test('homepage and contact page load without JavaScript runtime errors', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  for (const path of ['/', '/contact.html', '/privacy.html']) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), `${path} should load`).toBeTruthy();
    await expect(page.locator('#main-content')).toBeVisible();
  }

  expect(runtimeErrors).toEqual([]);
});

test('homepage preloader appears on first visit and every reload', async ({ page }) => {
  const preloader = page.locator('#site-preloader');

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(preloader).toBeVisible();
  await expect(preloader).toBeHidden({ timeout: 7000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(preloader).toBeVisible();
  await expect(preloader).toBeHidden({ timeout: 7000 });
});

test('theme choice toggles and persists across site pages', async ({ page }) => {
  await page.goto('/');
  const initialTheme = await page.locator('body').getAttribute('data-theme');
  const toggledTheme = initialTheme === 'dark' ? 'light' : 'dark';
  await page.locator('#home-theme-toggle').click();
  await expect(page.locator('body')).toHaveAttribute('data-theme', toggledTheme);
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-theme', toggledTheme);

  await page.goto('/contact.html');
  await expect(page.locator('body')).toHaveAttribute('data-theme', toggledTheme);
  await page.locator('#contact-theme-toggle').click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-theme',
    toggledTheme === 'dark' ? 'light' : 'dark'
  );
});

test('project enquiry dialog opens, receives focus, and closes with Escape', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a project' }).click();

  const dialog = page.getByRole('dialog', { name: 'Let’s plan your next build' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#intake-name')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('contact form guides paid mentorship enquiries through manual payment confirmation', async ({ page }) => {
  const submissionTypes = [];
  let submissionAttempts = 0;
  page.on('request', (request) => {
    if (request.url().startsWith('https://formspree.io/f/xjyvnjzn')) {
      submissionTypes.push(request.resourceType());
    }
  });
  await page.goto('/contact.html');
  await page.route('https://formspree.io/f/xjyvnjzn', (route) => {
    submissionAttempts += 1;
    return route.fulfill({
      status: submissionAttempts === 1 ? 200 : 422,
      contentType: 'application/json',
      body: JSON.stringify(
        submissionAttempts === 1
          ? { ok: true }
          : { error: 'Please try again after checking your details.' }
      )
    });
  });
  await expect(page.locator('#contact-form')).toBeVisible();
  await expect(page.locator('#from_name')).toHaveAttribute('required', '');
  await expect(page.locator('#reply_to')).toHaveAttribute('type', 'email');
  await expect(page.getByText('No payment portal or checkout is used on this website.')).toBeVisible();

  await page.locator('#from_name').fill('Test visitor');
  await page.locator('#reply_to').fill('visitor@example.test');
  await page.locator('#project_type').selectOption({
    label: 'Mentorship: Learning with direction ($10 / 30 minutes)'
  });
  await page.locator('#services_needed').selectOption({
    label: 'Learning with direction ($10 / 30 minutes)'
  });
  await page.locator('#message').fill('I would like help planning my web development learning path.');
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect.poll(() => submissionTypes).toEqual(['fetch']);
  await expect(page.locator('#form-status')).toContainText(
    'I will reply to confirm availability and share payment instructions'
  );
  await expect(page.locator('#form-status')).toContainText('your session is not booked yet');

  await page.reload();
  await page.locator('#from_name').fill('Test visitor');
  await page.locator('#reply_to').fill('visitor@example.test');
  await page.locator('#project_type').selectOption({
    label: 'Mentorship: Learning with direction ($10 / 30 minutes)'
  });
  await page.locator('#services_needed').selectOption({
    label: 'Learning with direction ($10 / 30 minutes)'
  });
  await page.locator('#message').fill('I would like help planning my web development learning path.');
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.locator('#form-status')).toHaveClass(/is-error/);
  await expect(page.locator('#form-status')).toContainText(
    'Please try again or email me directly at graham@grahamspaul.net.ng.'
  );
  await expect.poll(() => submissionTypes).toEqual(['fetch', 'fetch']);
});

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 }
]) {
  test(`homepage and contact page do not overflow at ${viewport.name} width`, async ({ page }) => {
    await page.setViewportSize(viewport);

    for (const path of ['/', '/contact.html', '/privacy.html']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const dimensions = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        overflow: Array.from(document.querySelectorAll('body *'))
          .map((element) => {
            const bounds = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              id: element.id,
              className: typeof element.className === 'string' ? element.className : '',
              left: Math.round(bounds.left),
              right: Math.round(bounds.right),
              width: Math.round(bounds.width)
            };
          })
          .filter((element) => element.right > window.innerWidth + 1 || element.left < -1)
          .slice(0, 12)
      }));
      expect(
        dimensions.documentWidth,
        `${path} should not scroll horizontally: ${JSON.stringify(dimensions.overflow)}`
      ).toBeLessThanOrEqual(dimensions.viewportWidth);
    }
  });
}

for (const path of ['/', '/contact.html', '/privacy.html']) {
  test(`${path} has no serious or critical axe accessibility violations`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    for (const viewport of [
      { width: 1365, height: 900 },
      { width: 390, height: 844 }
    ]) {
      await page.setViewportSize(viewport);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const seriousViolations = results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical'
      );
      expect(
        seriousViolations.map(({ id, help, nodes }) => ({
          id,
          help,
          targets: nodes.map(({ target }) => target)
        })),
        `${path} at ${viewport.width}px`
      ).toEqual([]);
    }
  });
}
