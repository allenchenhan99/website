import { expect, test, type Page } from '@playwright/test';

const routes = [
  ['index.html', 'AllenLin'],
  ['profile.html', 'Profile | AllenLin'],
  ['cv.html', 'CV | AllenLin'],
  ['music.html', 'Music | AllenLin'],
  ['perfume.html', 'Perfume | AllenLin'],
] as const;

function collectRuntimeErrors(
  page: Page,
  expectedConsoleErrorUrls: ReadonlySet<string> = new Set(),
) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (expectedConsoleErrorUrls.has(message.location().url)) return;
    errors.push(message.text());
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

  await page.getByRole('link', { name: 'CV', exact: true }).click();
  await expect(page).toHaveURL(/cv\.html$/);
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

// AC: Home owns the approved Profile composition at desktop and mobile widths.
// Behavior: Render Home → inspect content, ordering, overlay alignment, and navigation → the B layout remains intact without horizontal overflow.
// @category: e2e
// @dependency: full-system
// @complexity: medium
// ROI: 9
test('integrates the Profile B layout into Home', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('index.html');

  await expect(page.getByRole('link', { name: 'Profile', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Welcome to my Profile' })).toBeVisible();
  await expect(page.getByAltText('Background Photo')).toBeVisible();
  await expect(page.getByAltText('Profile Photo')).toBeVisible();

  const desktop = await page.locator('.home-profile').evaluate((section) => {
    const visual = section.querySelector<HTMLElement>('.home-profile-visual');
    const backdrop = section.querySelector<HTMLElement>('.home-profile-backdrop');
    const avatar = section.querySelector<HTMLElement>('.home-profile-avatar');
    const copy = section.querySelector<HTMLElement>('.home-profile-copy');
    if (!visual || !backdrop || !avatar || !copy) throw new Error('Profile composition is incomplete');
    const visualRect = visual.getBoundingClientRect();
    const backdropRect = backdrop.getBoundingClientRect();
    const avatarRect = avatar.getBoundingClientRect();
    const copyRect = copy.getBoundingClientRect();
    return {
      sectionWidth: section.getBoundingClientRect().width,
      visualLeft: visualRect.left,
      copyLeft: copyRect.left,
      avatarCenterX: avatarRect.left + avatarRect.width / 2,
      avatarCenterY: avatarRect.top + avatarRect.height / 2,
      expectedCenterX: backdropRect.left + visualRect.width * 0.52,
      expectedCenterY: visualRect.top + visualRect.height * 0.36,
      recentWidth: document.querySelector<HTMLElement>('.recent-posts')?.getBoundingClientRect().width ?? 0,
    };
  });

  expect(desktop.sectionWidth).toBeGreaterThanOrEqual(1100);
  expect(Math.abs(desktop.sectionWidth - desktop.recentWidth)).toBeLessThanOrEqual(2);
  expect(desktop.visualLeft).toBeLessThan(desktop.copyLeft);
  expect(Math.abs(desktop.avatarCenterX - desktop.expectedCenterX)).toBeLessThanOrEqual(2);
  expect(Math.abs(desktop.avatarCenterY - desktop.expectedCenterY)).toBeLessThanOrEqual(2);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.locator('.home-profile').evaluate((section) => {
    const visual = section.querySelector<HTMLElement>('.home-profile-visual');
    const copy = section.querySelector<HTMLElement>('.home-profile-copy');
    if (!visual || !copy) throw new Error('Profile composition is incomplete');
    const visualRect = visual.getBoundingClientRect();
    const copyRect = copy.getBoundingClientRect();
    return {
      visualBottom: visualRect.bottom,
      copyTop: copyRect.top,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(mobile.visualBottom).toBeLessThanOrEqual(mobile.copyTop);
  expect(mobile.pageWidth).toBeLessThanOrEqual(mobile.viewportWidth);
  expect(errors).toEqual([]);
});

// AC: Recent keeps the selected three-block rail on desktop and stacks on mobile.
// Behavior: Render Home at both widths → three recent notes are divided into readable blocks without overflow.
// @category: e2e
// @dependency: full-system
// @complexity: low
// ROI: 8
test('renders Recent as three divided blocks', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('index.html');

  const items = page.locator('[data-recent-open]');
  await expect(items).toHaveCount(3);
  const desktop = await items.evaluateAll((blocks) => blocks.map((block) => {
    const rect = block.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      borderLeftWidth: getComputedStyle(block).borderLeftWidth,
    };
  }));
  expect(new Set(desktop.map(({ top }) => Math.round(top))).size).toBe(1);
  expect(desktop[0]!.left).toBeLessThan(desktop[1]!.left);
  expect(desktop[1]!.borderLeftWidth).toBe('1px');

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await items.evaluateAll((blocks) => blocks.map((block) => {
    const rect = block.getBoundingClientRect();
    return { top: rect.top, borderTopWidth: getComputedStyle(block).borderTopWidth };
  }));
  expect(mobile[0]!.top).toBeLessThan(mobile[1]!.top);
  expect(mobile[1]!.borderTopWidth).toBe('1px');
  expect(errors).toEqual([]);
});

// AC: Home ends with the approved A + C reach signal instead of duplicate category links.
// Behavior: Render Home at desktop and mobile widths → the animated ASCII field and quiet market line remain readable without overflow.
// @category: e2e
// @dependency: full-system
// @complexity: medium
// ROI: 9
test('integrates the A plus C reach signal into Home', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('index.html');

  const signal = page.locator('.reach-signal');
  const ticker = signal.locator('[data-reach-ticker]');
  await expect(signal).toBeVisible();
  await expect(ticker).toContainText('RCH 1,284');
  await expect(ticker).toContainText('PVW 3,912');
  await expect(page.locator('.categories')).toHaveCount(0);

  const desktop = await signal.evaluate((section) => {
    const flowField = section.querySelector<HTMLElement>('[data-reach-flow]');
    const marketLine = section.querySelector<HTMLElement>('[data-reach-ticker]');
    const recent = document.querySelector<HTMLElement>('.recent-posts');
    if (!flowField || !marketLine || !recent) throw new Error('Reach signal is incomplete');
    return {
      width: section.getBoundingClientRect().width,
      top: section.getBoundingClientRect().top,
      recentBottom: recent.getBoundingClientRect().bottom,
      rows: flowField.textContent?.split('\n').length ?? 0,
      tickerOverflow: marketLine.scrollWidth - marketLine.clientWidth,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(desktop.width).toBeGreaterThanOrEqual(1100);
  expect(desktop.top).toBeGreaterThanOrEqual(desktop.recentBottom);
  expect(desktop.rows).toBe(21);
  expect(desktop.tickerOverflow).toBe(0);
  expect(desktop.pageOverflow).toBe(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(
    () => signal.locator('[data-reach-flow]').evaluate((field) => field.textContent?.split('\n').length ?? 0),
  ).toBe(18);
  const mobile = await signal.evaluate((section) => {
    const flowField = section.querySelector<HTMLElement>('[data-reach-flow]');
    const marketLine = section.querySelector<HTMLElement>('[data-reach-ticker]');
    if (!flowField || !marketLine) throw new Error('Reach signal is incomplete');
    return {
      width: section.getBoundingClientRect().width,
      rows: flowField.textContent?.split('\n').length ?? 0,
      tickerOverflow: marketLine.scrollWidth - marketLine.clientWidth,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(mobile.width).toBeLessThanOrEqual(358);
  expect(mobile.rows).toBe(18);
  expect(mobile.tickerOverflow).toBe(0);
  expect(mobile.pageOverflow).toBe(0);
  expect(errors).toEqual([]);
});

// AC: Music uses its original Nujabes background and replaces the blue vinyl area with the album artwork without obscuring the introduction.
// Behavior: Render Music on desktop and mobile → the picture-disc artwork remains visible inside the black rim and the copy stays readable without overflow.
// @category: e2e
// @dependency: full-system
// @complexity: medium
// ROI: 9
test('integrates the original Nujabes background and album-art picture disc into Music', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('music.html');

  const background = page.getByAltText('Nujabes Metaphorical Music album artwork');
  const vinyl = page.locator('.vinyl-record[data-vinyl="album-art"]');
  const vinylArtwork = vinyl.locator('.vinyl-artwork');
  await expect(background).toBeVisible();
  await expect(vinyl).toBeVisible();
  await expect(vinylArtwork).toBeVisible();
  await expect(vinyl).toHaveAttribute('aria-label', 'Rotating vinyl record filled with Nujabes Metaphorical Music cover art');

  const desktop = await page.locator('.image-container').evaluate((hero) => {
    const copy = hero.querySelector<HTMLElement>('.text-container');
    const record = hero.querySelector<HTMLElement>('.vinyl-record');
    if (!copy || !record) throw new Error('Music hero composition is incomplete');
    const copyRect = copy.getBoundingClientRect();
    const recordRect = record.getBoundingClientRect();
    const recordDiameter = Number.parseFloat(getComputedStyle(record).width);
    const recordCenterX = recordRect.left + recordRect.width / 2;
    return {
      recordVisualRight: recordCenterX + recordDiameter / 2,
      copyLeft: copyRect.left,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(desktop.recordVisualRight).toBeLessThanOrEqual(desktop.copyLeft);
  expect(desktop.pageWidth).toBeLessThanOrEqual(desktop.viewportWidth);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.locator('.image-container').evaluate((hero) => {
    const picture = hero.querySelector<HTMLElement>('picture');
    const copy = hero.querySelector<HTMLElement>('.text-container');
    const record = hero.querySelector<HTMLElement>('.vinyl-record');
    if (!picture || !copy || !record) throw new Error('Music hero composition is incomplete');
    const pictureRect = picture.getBoundingClientRect();
    const copyRect = copy.getBoundingClientRect();
    const recordRect = record.getBoundingClientRect();
    const recordDiameter = Number.parseFloat(getComputedStyle(record).width);
    const recordCenterX = recordRect.left + recordRect.width / 2;
    const recordCenterY = recordRect.top + recordRect.height / 2;
    return {
      copyTop: copyRect.top,
      pictureBottom: pictureRect.bottom,
      recordVisualLeft: recordCenterX - recordDiameter / 2,
      recordVisualTop: recordCenterY - recordDiameter / 2,
      recordVisualRight: recordCenterX + recordDiameter / 2,
      recordVisualBottom: recordCenterY + recordDiameter / 2,
      pictureLeft: pictureRect.left,
      pictureTop: pictureRect.top,
      pictureRight: pictureRect.right,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(mobile.copyTop).toBeGreaterThanOrEqual(mobile.pictureBottom);
  expect(mobile.recordVisualLeft).toBeGreaterThanOrEqual(mobile.pictureLeft);
  expect(mobile.recordVisualTop).toBeGreaterThanOrEqual(mobile.pictureTop);
  expect(mobile.recordVisualRight).toBeLessThanOrEqual(mobile.pictureRight);
  expect(mobile.recordVisualBottom).toBeLessThanOrEqual(mobile.pictureBottom);
  expect(mobile.pageWidth).toBeLessThanOrEqual(mobile.viewportWidth);
  expect(errors).toEqual([]);
});

// AC: Music keeps compact playlist links in the hero and persists Grid/List selection.
// Behavior: Inspect the hero playlist rail and select List → links stay left of the description and view preference survives reload.
// @category: e2e
// @dependency: full-system
// @complexity: medium
// ROI: 9
test('keeps compact Spotify links beside the Music description and persists list view', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('music.html');

  const playlistRail = page.locator('.hero-playlists');
  const playlistLinks = playlistRail.locator('.hero-playlist-link');
  const playlistCovers = playlistRail.locator('.hero-playlist-cover');
  await expect(playlistRail).toBeVisible();
  await expect(playlistLinks).toHaveCount(2);
  await expect(playlistCovers).toHaveCount(2);
  await expect(page.locator('.playlists-section')).toHaveCount(0);
  await expect(page.locator('[data-spotify-embed]')).toHaveCount(0);
  for (const link of await playlistLinks.all()) {
    await expect(link).toHaveAttribute('href', /^https:\/\/open\.spotify\.com\/playlist\//);
    await expect(link).not.toHaveAttribute('href', /\/embed\//);
  }
  const desktop = await page.locator('.image-container').evaluate((hero) => {
    const rail = hero.querySelector<HTMLElement>('.hero-playlists');
    const copy = hero.querySelector<HTMLElement>('.text-container');
    if (!rail || !copy) throw new Error('Music hero playlist composition is incomplete');
    return {
      railRight: rail.getBoundingClientRect().right,
      copyLeft: copy.getBoundingClientRect().left,
    };
  });
  expect(desktop.copyLeft - desktop.railRight).toBeGreaterThanOrEqual(39);

  const musicView = page.locator('[data-music-view]');
  const gridPanel = page.locator('[data-view-panel="grid"]');
  const listPanel = page.locator('[data-view-panel="list"]');
  await expect(musicView).toHaveAttribute('data-view', 'grid');
  await expect(gridPanel).toBeVisible();
  await expect(listPanel).toBeHidden();

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

// AC: The Starwalker card, filters, and five-paragraph detail work without page errors.
// Behavior: Open the collection, filter its single entry, and open its article → the selected B presentation stays intact.
// @category: e2e
// @dependency: full-system
// @complexity: medium
// ROI: 9
test('renders and opens the selected Starwalker perfume entry', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('perfume.html');
  const card = page.locator('[data-perfume-card]');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Montblanc');
  await expect(card).toContainText('Starwalker');
  await expect(card.locator('.personal-title')).toHaveText('安靜得剛剛好。');
  await expect(page.locator('[data-perfume-count]')).toHaveText('1 fragrance');
  await expect(page.locator('[data-perfume-empty]')).toBeHidden();
  await expect(page.locator('.hero-description')).toContainText('To me, perfume is part of an outfit');
  await expect(page.locator('.hero-collection-rail')).toBeVisible();
  const cardGeometry = await card.evaluate((element) => {
    const image = element.querySelector<HTMLImageElement>('.compact-card-image');
    if (!image) throw new Error('Perfume bottle image is missing');
    const cardRect = element.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    return {
      cardWidth: cardRect.width,
      imageTop: imageRect.top,
      imageBottom: imageRect.bottom,
      cardTop: cardRect.top,
      cardBottom: cardRect.bottom,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    };
  });
  expect(cardGeometry.cardWidth).toBeLessThan(320);
  expect(cardGeometry.imageTop).toBeGreaterThanOrEqual(cardGeometry.cardTop);
  expect(cardGeometry.imageBottom).toBeLessThanOrEqual(cardGeometry.cardBottom);
  expect(cardGeometry.naturalHeight).toBeGreaterThan(cardGeometry.naturalWidth);

  const scentMode = page.getByRole('button', { name: 'By Scent' });
  const brandMode = page.getByRole('button', { name: 'By Brand' });
  await expect(scentMode).toHaveAttribute('aria-pressed', 'true');
  await expect(brandMode).toHaveAttribute('aria-pressed', 'false');

  await brandMode.click();
  await expect(brandMode).toHaveAttribute('aria-pressed', 'true');
  await expect(scentMode).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-filter-value="Montblanc"]').click();
  await expect(page.locator('[data-perfume-count]')).toHaveText('1 fragrance');
  await expect(card).toBeVisible();

  await scentMode.click();
  await expect(scentMode).toHaveAttribute('aria-pressed', 'true');
  await expect(brandMode).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-filter-value="White Musk"]').click();
  await expect(page.locator('[data-perfume-count]')).toHaveText('1 fragrance');

  await card.click();
  const dialog = page.locator('[data-perfume-dialog]');
  await expect(dialog).toHaveJSProperty('open', true);
  await expect(dialog.locator('[data-dialog-title]')).toHaveText('安靜得剛剛好。');
  await expect(dialog.locator('[data-dialog-content] p')).toHaveCount(5);
  await expect(dialog.locator('[data-dialog-source]')).toHaveAttribute('href', 'https://makeup.jp/en/product/3452/');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveJSProperty('open', false);
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
