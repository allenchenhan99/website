import { expect, test, type Page } from '@playwright/test';

const routes = [
  ['index.html', 'AllenLin'],
  ['profile.html', 'Profile | AllenLin'],
  ['cv.html', 'CV | AllenLin'],
  ['music.html', 'Music | AllenLin'],
  ['perfume.html', 'Perfume | AllenLin'],
] as const;

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

// AC: All five /website/*.html routes return 200 and correct titles, without public Vue requests.
// Behavior: Visit every public route → Astro serves the built page → status, title, and network are correct.
// @category: e2e
// @dependency: full-system
// @complexity: medium
// ROI: 9
test('serves every public HTML route without the Vue CDN', async ({ page }) => {
  const vueRequests: string[] = [];
  const errors = collectRuntimeErrors(page);
  page.on('request', (request) => {
    if (request.url().includes('unpkg.com/vue')) vueRequests.push(request.url());
  });

  for (const [route, title] of routes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page).toHaveTitle(title);
  }

  expect(vueRequests).toEqual([]);
  expect(errors).toEqual([]);
});

// AC: Theme toggles and persists between pages.
// Behavior: Toggle the theme and navigate → local preference is read by the next page → theme remains selected.
// @category: e2e
// @dependency: full-system
// @complexity: medium
// ROI: 8
test('persists the selected theme across public pages', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('index.html');
  const initialTheme = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: /Switch to (?:light|dark) mode/ }).click();
  const selectedTheme = initialTheme === 'dark' ? 'light' : 'dark';
  await expect(page.locator('html')).toHaveAttribute('data-theme', selectedTheme);

  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page).toHaveURL(/profile\.html$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', selectedTheme);
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(selectedTheme);
  expect(errors).toEqual([]);
});

// AC: CV switches English/Chinese.
// Behavior: Use the CV language control → paired content visibility changes → Chinese content and document language are active.
// @category: e2e
// @dependency: full-system
// @complexity: low
// ROI: 8
test('switches the CV from English to Chinese', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('cv.html');
  await page.evaluate(() => localStorage.removeItem('cv-lang'));
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Chen-Han Lin' })).toBeVisible();
  await page.getByRole('button', { name: /中文/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant');
  await expect(page.getByRole('heading', { name: '林辰翰' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('cv-lang'))).toBe('zh');
  expect(errors).toEqual([]);
});

// AC: Home Recent dialog opens and closes.
// Behavior: Select a recent post and close its dialog → details appear modally → dialog returns to closed state.
// @category: e2e
// @dependency: full-system
// @complexity: low
// ROI: 8
test('opens and closes a Home Recent detail dialog', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('index.html');
  await page.locator('[data-recent-open]').first().click();
  const dialog = page.locator('[data-detail-dialog]');
  await expect(dialog).toHaveJSProperty('open', true);
  await expect(dialog.locator('[data-detail-title]')).not.toHaveText('');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveJSProperty('open', false);
  expect(errors).toEqual([]);
});

// AC: Music defers Spotify until approach and persists Grid/List selection.
// Behavior: Approach one Spotify card and select List → one iframe is created and view preference survives reload.
// @category: e2e
// @dependency: full-system
// @complexity: high
// ROI: 10
test('lazy-loads one nearby Spotify embed and persists Music list view', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 390, height: 600 });
  await page.route('https://open.spotify.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><title>Spotify test double</title>',
  }));
  await page.goto('music.html');
  const musicView = page.locator('[data-music-view]');
  const gridPanel = page.locator('[data-view-panel="grid"]');
  const listPanel = page.locator('[data-view-panel="list"]');
  await expect(musicView).toHaveAttribute('data-view', 'grid');
  await expect(gridPanel).toBeVisible();
  await expect(listPanel).toBeHidden();

  const initialGeometry = await page.locator('[data-spotify-embed]').first().evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    viewportHeight: window.innerHeight,
  }));
  expect(initialGeometry.top).toBeGreaterThan(initialGeometry.viewportHeight + 300);
  await expect(page.locator('[data-spotify-embed] iframe')).toHaveCount(0);
  // Deliberate bounded stability window: the observer must not load while the card stays outside its margin.
  await page.waitForTimeout(350);
  await expect(page.locator('[data-spotify-embed] iframe')).toHaveCount(0);

  await page.locator('[data-spotify-embed]').first().evaluate((element) => {
    const targetTop = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, targetTop - window.innerHeight - 250);
  });
  const approachedGeometry = await page.locator('[data-spotify-embed]').evaluateAll((embeds) => ({
    firstTop: embeds[0]?.getBoundingClientRect().top,
    secondTop: embeds[1]?.getBoundingClientRect().top,
    viewportHeight: window.innerHeight,
  }));
  expect(approachedGeometry.firstTop).toBeLessThanOrEqual(approachedGeometry.viewportHeight + 300);
  expect(approachedGeometry.secondTop).toBeGreaterThan(approachedGeometry.viewportHeight + 300);
  await expect(page.locator('[data-spotify-embed] iframe')).toHaveCount(1);

  await page.getByRole('button', { name: 'List view' }).click();
  await expect(musicView).toHaveAttribute('data-view', 'list');
  await expect(gridPanel).toBeHidden();
  await expect(listPanel).toBeVisible();
  await page.reload();
  await expect(musicView).toHaveAttribute('data-view', 'list');
  await expect(gridPanel).toBeHidden();
  await expect(listPanel).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('music-view'))).toBe('list');
  expect(errors).toEqual([]);
});

// AC: Perfume zero state and filter controls work without page errors.
// Behavior: Open an empty collection and change filter mode → controls remain usable → zero-state stays visible.
// @category: e2e
// @dependency: full-system
// @complexity: low
// ROI: 7
test('keeps Perfume empty-state filters interactive', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('perfume.html');
  await expect(page.locator('[data-perfume-empty]')).toBeVisible();
  await expect(page.locator('[data-perfume-count]')).toHaveText('0 fragrances');
  const scentMode = page.getByRole('button', { name: 'By Scent' });
  const brandMode = page.getByRole('button', { name: 'By Brand' });
  await expect(scentMode).toHaveAttribute('aria-pressed', 'true');
  await expect(brandMode).toHaveAttribute('aria-pressed', 'false');

  await brandMode.click();
  await expect(brandMode).toHaveAttribute('aria-pressed', 'true');
  await expect(scentMode).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-perfume-count]')).toHaveText('0 fragrances');
  await expect(page.locator('[data-filter-value="All"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-perfume-empty]')).toBeVisible();

  await scentMode.click();
  await expect(scentMode).toHaveAttribute('aria-pressed', 'true');
  await expect(brandMode).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-perfume-count]')).toHaveText('0 fragrances');
  await expect(page.locator('[data-filter-value="All"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-filter-value="All"]')).toBeVisible();
  await expect(page.locator('[data-perfume-empty]')).toBeVisible();
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
]) {
  // AC: Every public route is horizontally contained at desktop, tablet, and phone sizes.
  // Behavior: Render each route at a target viewport → responsive CSS constrains content → document never exceeds viewport width.
  // @category: e2e
  // @dependency: full-system
  // @complexity: medium
  // ROI: 9
  test(`contains all public routes at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const [route] of routes) {
      await page.goto(route);
      if (route === 'index.html') {
        const asciiState = await page.evaluate(() => ({
          rendered: document.querySelector('[data-ascii-animation]')?.textContent?.trimEnd(),
          source: document.querySelector<HTMLTemplateElement>('[data-ascii-source]')
            ?.content.textContent?.trimEnd(),
        }));
        expect(asciiState.source?.length).toBeGreaterThan(0);
        expect(asciiState.rendered).toBe(asciiState.source);
      }
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(dimensions.scrollWidth, route).toBeLessThanOrEqual(dimensions.innerWidth);
    }

    expect(errors).toEqual([]);
  });
}
