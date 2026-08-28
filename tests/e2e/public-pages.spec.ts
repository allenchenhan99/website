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
test('keeps a direct Spotify link through a failed deferred embed and persists Music list view', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 390, height: 600 });
  await page.route('https://open.spotify.com/**', (route) => route.fulfill({
    status: 500,
    contentType: 'text/html',
    body: '<!doctype html><title>Spotify failure test double</title>',
  }));
  await page.goto('music.html');
  const firstEmbed = page.locator('[data-spotify-embed]').first();
  const directLink = firstEmbed.locator('[data-spotify-fallback]');
  await expect(directLink).toBeVisible();
  await expect(directLink).toHaveAttribute('href', /^https:\/\/open\.spotify\.com\/playlist\//);
  await expect(directLink).toHaveAttribute('target', '_blank');
  const musicView = page.locator('[data-music-view]');
  const gridPanel = page.locator('[data-view-panel="grid"]');
  const listPanel = page.locator('[data-view-panel="list"]');
  await expect(musicView).toHaveAttribute('data-view', 'grid');
  await expect(gridPanel).toBeVisible();
  await expect(listPanel).toBeHidden();

  const initialGeometry = await firstEmbed.evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    viewportHeight: window.innerHeight,
  }));
  expect(initialGeometry.top).toBeGreaterThan(initialGeometry.viewportHeight + 300);
  await expect(page.locator('[data-spotify-embed] iframe')).toHaveCount(0);
  // Deliberate bounded stability window: the observer must not load while the card stays outside its margin.
  await page.waitForTimeout(350);
  await expect(page.locator('[data-spotify-embed] iframe')).toHaveCount(0);

  await firstEmbed.evaluate((element) => {
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
  await expect(directLink).toBeVisible();
  await expect(directLink).toBeEnabled();

  await page.getByRole('button', { name: 'List view' }).click();
  await expect(musicView).toHaveAttribute('data-view', 'list');
  await expect(gridPanel).toBeHidden();
  await expect(listPanel).toBeVisible();
  await page.reload();
  await expect(musicView).toHaveAttribute('data-view', 'list');
  await expect(gridPanel).toBeHidden();
  await expect(listPanel).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('music-view'))).toBe('list');
  const unexpectedErrors = errors.filter((message) => (
    !message.includes('server responded with a status of 500')
  ));
  expect(unexpectedErrors).toEqual([]);
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
  // AC: Profile keeps its intentional crop and optimized responsive source at every target viewport.
  // Behavior: Render Profile → inspect actual wrapper/image geometry and selected picture source → crop and optimization remain active.
  // @category: e2e
  // @dependency: full-system
  // @complexity: medium
  // ROI: 9
  test(`preserves the Profile avatar crop at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.setViewportSize(viewport);
    await page.goto('profile.html');

    const avatar = page.locator('[data-profile-avatar]');
    const image = avatar.locator('img');
    await expect(avatar).toHaveCount(1);
    await expect(image).toBeVisible();
    await image.evaluate(async (element) => {
      await (element as HTMLImageElement).decode();
    });

    const geometry = await avatar.evaluate((wrapper) => {
      const container = wrapper.closest('.image-container');
      const picture = wrapper.querySelector('picture');
      const imageElement = wrapper.querySelector('img');
      if (!container || !picture || !imageElement) throw new Error('Profile avatar markup is incomplete');

      const wrapperRect = wrapper.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const imageRect = imageElement.getBoundingClientRect();
      const wrapperStyle = getComputedStyle(wrapper);
      const imageStyle = getComputedStyle(imageElement);
      const matrix = new DOMMatrixReadOnly(imageStyle.transform);
      const sources = [...picture.querySelectorAll('source')].map((source) => ({
        type: source.type,
        sizes: source.sizes,
        srcset: source.srcset,
      }));

      return {
        wrapperWidth: wrapperRect.width,
        wrapperHeight: wrapperRect.height,
        wrapperCenterX: wrapperRect.left + wrapperRect.width / 2,
        wrapperCenterY: wrapperRect.top + wrapperRect.height / 2,
        expectedCenterX: containerRect.left + containerRect.width * 0.51,
        expectedCenterY: containerRect.top + containerRect.height * (innerWidth <= 768 ? 0.45 : 0.42),
        wrapperPosition: wrapperStyle.position,
        wrapperOverflow: wrapperStyle.overflow,
        wrapperRadius: wrapperStyle.borderRadius,
        imageWidth: imageRect.width,
        imageHeight: imageRect.height,
        imageLeft: imageRect.left,
        imageTop: imageRect.top,
        wrapperLeft: wrapperRect.left,
        wrapperTop: wrapperRect.top,
        objectFit: imageStyle.objectFit,
        objectPosition: imageStyle.objectPosition,
        scaleX: Math.hypot(matrix.a, matrix.b),
        scaleY: Math.hypot(matrix.c, matrix.d),
        currentPath: new URL(imageElement.currentSrc).pathname,
        fallbackPath: new URL(imageElement.src).pathname,
        sources,
      };
    });

    const expectedSize = Math.min(290, Math.max(140, viewport.width * 0.32 - 10));
    expect(Math.abs(geometry.wrapperWidth - expectedSize)).toBeLessThanOrEqual(2);
    expect(Math.abs(geometry.wrapperHeight - expectedSize)).toBeLessThanOrEqual(2);
    expect(Math.abs(geometry.wrapperWidth - geometry.wrapperHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.wrapperCenterX - geometry.expectedCenterX)).toBeLessThanOrEqual(2);
    expect(Math.abs(geometry.wrapperCenterY - geometry.expectedCenterY)).toBeLessThanOrEqual(2);
    expect(geometry.wrapperPosition).toBe('absolute');
    expect(geometry.wrapperOverflow).toBe('hidden');
    expect(geometry.wrapperRadius).toBe('50%');
    expect(geometry.objectFit).toBe('cover');
    expect(geometry.objectPosition).toBe('25% 58%');
    expect(Math.abs(geometry.scaleX - 1.25)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(geometry.scaleY - 1.25)).toBeLessThanOrEqual(0.01);
    expect(geometry.imageWidth).toBeGreaterThan(geometry.wrapperWidth * 1.24);
    expect(geometry.imageHeight).toBeGreaterThan(geometry.wrapperHeight * 1.24);
    expect(geometry.imageLeft).toBeLessThan(geometry.wrapperLeft);
    expect(geometry.imageTop).toBeLessThan(geometry.wrapperTop);
    expect(geometry.sources.map(({ type }) => type)).toEqual(['image/avif', 'image/webp']);
    for (const source of geometry.sources) {
      expect(source.sizes).toContain('(max-width: 768px) 190px');
      expect(source.srcset).toContain('/website/_astro/selfie.');
      expect(source.srcset).toContain(source.type === 'image/avif' ? '.avif' : '.webp');
    }
    expect(geometry.currentPath).toMatch(/^\/website\/_astro\/selfie\..+\.avif$/);
    expect(geometry.fallbackPath).toMatch(/^\/website\/_astro\/selfie\..+\.jpg$/);
    expect(geometry.currentPath).not.toBe(geometry.fallbackPath);
    expect(errors).toEqual([]);
  });

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
