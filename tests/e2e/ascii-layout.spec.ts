import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function openHome(page: Page) {
  await page.goto('index.html');
  await expect(page.locator('[data-ascii-animation]')).not.toHaveText('');
  await page.evaluate(() => document.fonts.ready);
}

async function artworkBounds(page: Page) {
  return page.locator('.ascii-art, .chipi-animation').evaluateAll((artworks) => artworks.map((artwork) => {
    const stage = artwork.closest('[data-ascii-artwork]') ?? artwork;
    const box = stage.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(artwork);
    const text = range.getBoundingClientRect();
    return {
      leftOverflow: Math.max(0, box.left - text.left),
      rightOverflow: Math.max(0, text.right - box.right),
      bottomOverflow: Math.max(0, text.bottom - box.bottom),
      width: text.width,
      height: text.height,
    };
  }));
}

test('keeps title glyphs and all six row starts aligned in a Chinese document', async ({ page }) => {
  await openHome(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant');
  const dimensions = await page.locator('[data-ascii-animation]').evaluate((artwork) => {
    const node = artwork.firstChild;
    if (!node?.textContent) throw new Error('Missing ASCII title');
    const source = node.textContent;
    const glyphWidths = [...new Set(source.replaceAll('\n', ''))].map((character) => {
      // Average repeated glyphs to avoid WebKit's per-character rounding.
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
      probe.textContent = character.repeat(32);
      artwork.append(probe);
      const width = probe.getBoundingClientRect().width / 32;
      probe.remove();
      return width;
    });
    let offset = 0;
    const rows = source.split('\n').map((row) => {
      const range = document.createRange();
      range.setStart(node, offset);
      range.setEnd(node, offset + row.length);
      offset += row.length + 1;
      const bounds = range.getBoundingClientRect();
      return { left: bounds.left, width: bounds.width };
    });
    return {
      bundledFontLoaded: [...document.fonts].some((font) => font.family.replaceAll('"', '') === 'Site ASCII' && font.status === 'loaded'),
      rowCount: rows.length,
      glyphSpread: Math.max(...glyphWidths) - Math.min(...glyphWidths),
      rowStartSpread: Math.max(...rows.map((row) => row.left)) - Math.min(...rows.map((row) => row.left)),
      rowWidthSpread: Math.max(...rows.map((row) => row.width)) - Math.min(...rows.map((row) => row.width)),
    };
  });
  expect(dimensions.bundledFontLoaded).toBe(true);
  expect(dimensions.rowCount).toBe(6);
  expect(dimensions.glyphSpread).toBeLessThan(0.08);
  expect(dimensions.rowStartSpread).toBeLessThan(0.2);
  expect(dimensions.rowWidthSpread).toBeLessThan(0.3);
});

test('shows the complete artwork at phone, tablet, and desktop widths', async ({ page }) => {
  await openHome(page);
  for (const width of [320, 360, 390, 430, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(async () => {
      const bounds = await artworkBounds(page);
      return Math.max(...bounds.flatMap((artwork) => [artwork.leftOverflow, artwork.rightOverflow, artwork.bottomOverflow]));
    }, { message: `Artwork must fit at ${width}px` }).toBeLessThanOrEqual(2);
    for (const artwork of await artworkBounds(page)) {
      expect(artwork.width).toBeGreaterThan(0);
      expect(artwork.height).toBeGreaterThan(0);
    }
  }
});

test('refits enlarged text and reserves enough space before the profile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openHome(page);
  await page.locator('.ascii-art, .chipi-animation').evaluateAll((artworks) => {
    for (const artwork of artworks) (artwork as HTMLElement).style.fontSize = '24px';
  });
  await expect.poll(async () => {
    const bounds = await artworkBounds(page);
    return Math.max(...bounds.flatMap((artwork) => [artwork.leftOverflow, artwork.rightOverflow, artwork.bottomOverflow]));
  }).toBeLessThanOrEqual(2);
  const separation = await page.evaluate(() => {
    const chipi = document.querySelector('.chipi-animation');
    const profile = document.querySelector('.home-profile');
    if (!chipi || !profile) throw new Error('Missing Home artwork or profile');
    const range = document.createRange();
    range.selectNodeContents(chipi);
    return profile.getBoundingClientRect().top - range.getBoundingClientRect().bottom;
  });
  expect(separation).toBeGreaterThanOrEqual(20);
});
