import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { recentPosts } from '../lib/content';

const rootPath = fileURLToPath(new URL('../../', import.meta.url));
const ascii = readFileSync(`${rootPath}asciiArt.txt`, 'utf8');
const chipi = readFileSync(`${rootPath}chipi.txt`, 'utf8');
const homePage = readFileSync(`${rootPath}src/pages/index.astro`, 'utf8');

const loadHome = async () => import('./home').catch(() => ({}));

describe('home animation helpers', () => {
  test('builds the first ASCII block from the first ten columns', async () => {
    const home = await loadHome();
    expect(home).toHaveProperty('buildAsciiFrame');
    if (!('buildAsciiFrame' in home)) return;

    const expectedFirstBlock = ascii
      .split('\n')
      .slice(0, 6)
      .map((line) => line.slice(0, 10))
      .join('\n');

    expect(home.buildAsciiFrame(ascii, 0)).toContain(expectedFirstBlock);
  });

  test('composes the complete ASCII artwork after exactly 26 blocks', async () => {
    const home = await loadHome();
    expect(home).toHaveProperty('buildAsciiFrame');
    if (!('buildAsciiFrame' in home)) return;

    expect(home.buildAsciiFrame(ascii, 25).trimEnd()).toBe(ascii.trimEnd());
  });

  test('splits the Chipi source into 23 complete 42-line frames', async () => {
    const home = await loadHome();
    expect(home).toHaveProperty('splitChipiFrames');
    if (!('splitChipiFrames' in home)) return;

    const lines = chipi.trimEnd().split('\n');
    const frames = home.splitChipiFrames(lines, 42);

    expect(frames).toHaveLength(23);
    expect(frames[0]?.split('\n')).toHaveLength(42);
    expect(frames.at(-1)?.split('\n')).toHaveLength(42);
  });
});

describe('build-time home contracts', () => {
  test('uses three validated Recent entries in descending date order', () => {
    expect(recentPosts).toHaveLength(3);
    expect(recentPosts.map(({ date }) => date)).toEqual(
      [...recentPosts.map(({ date }) => date)].sort((left, right) =>
        right.localeCompare(left),
      ),
    );
    expect(homePage).toContain('recentPosts.map');
  });

  test('embeds ASCII and the initial Chipi frame without runtime fetches', () => {
    expect(homePage).toContain('asciiArt.txt?raw');
    expect(homePage).toContain('chipi.txt?raw');
    expect(homePage).toContain('chipi.txt?url');
    expect(homePage).not.toMatch(/fetch\([^)]*(?:posts\/|asciiArt\.txt)/);
  });

  test('declares reduced-motion, idle loading, rAF throttling, and visibility pause', async () => {
    const homeScript = readFileSync(`${rootPath}src/scripts/home.ts`, 'utf8');

    expect(homeScript).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(homeScript).toContain('requestIdleCallback');
    expect(homeScript).toContain('requestAnimationFrame');
    expect(homeScript).toContain('document.hidden');
    expect(homeScript).toContain('100');
    expect(homeScript).toContain('20');
  });
});
