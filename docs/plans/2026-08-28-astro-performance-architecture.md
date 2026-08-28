# AllenLin Astro Performance Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 將 AllenLin 公開網站改成 Astro 靜態輸出，在維持現有視覺與互動的前提下移除公開頁面的 Vue runtime、改善圖片與 Spotify 載入，並以 GitHub Actions 自動部署。

**Architecture:** Astro 在 build time 讀取現有 JSON 與文字來源並產生完整 `.html` 頁面。公開頁面只保留 Theme、語言、Modal、篩選與動畫所需的原生 TypeScript；既有 Vue 管理後台隔離保留，提交內容到 `main` 後觸發新的靜態建置。

**Tech Stack:** Astro 7.2.9、TypeScript 7.0.2、Vitest 4.1.11、Playwright 1.62.1、Sharp 0.35.4、Python unittest、GitHub Actions、GitHub Pages

---

執行時使用 `@superpowers:test-driven-development`，完成前使用 `@superpowers:verification-before-completion`，效能驗收使用 `@chrome-devtools-mcp:debug-optimize-lcp`。設計依據見 `docs/plans/2026-08-28-astro-performance-architecture-design.md`。

參考文件：

- Astro GitHub Pages：https://docs.astro.build/en/guides/deploy/github/
- Astro Assets：https://docs.astro.build/en/reference/modules/astro-assets/
- Astro client scripts：https://docs.astro.build/en/guides/client-side-scripts/
- Astro `build.format`：https://docs.astro.build/en/reference/configuration-reference/#buildformat

### Task 1: 建立 Astro 工具鏈與路由 contract

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `src/env.d.ts`
- Create: `src/pages/index.astro`
- Create: `src/pages/profile.astro`
- Create: `src/pages/cv.astro`
- Create: `src/pages/music.astro`
- Create: `src/pages/perfume.astro`
- Create: `tests/test_astro_architecture.py`
- Modify: `.gitignore`

**Step 1: Write the failing architecture contract**

Create `tests/test_astro_architecture.py`:

```python
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
ROUTES = ("index", "profile", "cv", "music", "perfume")


class AstroArchitectureTest(unittest.TestCase):
    def test_astro_toolchain_exists(self):
        self.assertTrue((ROOT / "package.json").exists())
        self.assertTrue((ROOT / "astro.config.mjs").exists())

    def test_public_routes_are_astro_pages(self):
        for route in ROUTES:
            with self.subTest(route=route):
                self.assertTrue((ROOT / "src" / "pages" / f"{route}.astro").exists())

    def test_build_uses_file_output_and_repository_base(self):
        config = (ROOT / "astro.config.mjs").read_text(encoding="utf-8")
        self.assertIn("format: 'file'", config)
        self.assertIn("base: '/website'", config)


if __name__ == "__main__":
    unittest.main()
```

**Step 2: Run the contract and verify it fails**

Run: `python3 -m unittest tests.test_astro_architecture -v`  
Expected: FAIL because `package.json`, Astro config, and `src/pages` do not exist.

**Step 3: Add the minimal toolchain**

Create `package.json`:

```json
{
  "name": "allenlin-website",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "packageManager": "npm@11.11.0",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "npm run test:unit && npm run test:contracts",
    "test:unit": "vitest run",
    "test:contracts": "python3 -m unittest discover -s tests -p 'test_*.py'",
    "test:e2e": "playwright test",
    "verify": "npm run check && npm test && npm run build && npm run test:e2e"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.10",
    "@playwright/test": "^1.62.1",
    "@types/node": "^26.4.0",
    "astro": "^7.2.9",
    "sharp": "^0.35.4",
    "typescript": "^7.0.2",
    "vitest": "^4.1.11"
  }
}
```

Create `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://allenchenhan99.github.io',
  base: '/website',
  output: 'static',
  build: { format: 'file' },
});
```

Create `tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true
  }
}
```

Create `src/env.d.ts` containing `/// <reference types="astro/client" />`. Create each initial page with a unique `<h1>` so Astro can build all five routes.

Update `.gitignore` with:

```gitignore
node_modules/
dist/
.astro/
playwright-report/
test-results/
```

Run: `npm install`  
Expected: creates a committed `package-lock.json` with Astro 7.2.9-compatible dependencies.

**Step 4: Run contracts and build**

Run: `python3 -m unittest tests.test_astro_architecture -v && npm run build`  
Expected: PASS and `dist/index.html`, `dist/profile.html`, `dist/cv.html`, `dist/music.html`, `dist/perfume.html` exist.

**Step 5: Commit**

```bash
git add .gitignore package.json package-lock.json astro.config.mjs tsconfig.json src/env.d.ts src/pages tests/test_astro_architecture.py
git commit -m "build: add Astro static site toolchain"
```

### Task 2: 建立內容型別、驗證與 build-time recent posts

**Files:**
- Create: `src/config/site.ts`
- Create: `src/lib/content.ts`
- Create: `src/lib/content.test.ts`
- Read: `posts/music.json`
- Read: `posts/perfume.json`

**Step 1: Write failing validation tests**

Create `src/lib/content.test.ts` with tests for valid Music/Perfume arrays, invalid date, duplicate IDs, missing required fields, missing optional covers becoming empty strings, and merged recent-post ordering.

Core assertions:

```ts
expect(() => parseMusicPosts([{ id: 1, date: '2026-08-28' }])).toThrow(/date/);
expect(() => parseMusicPosts([music(1), music(1)])).toThrow(/duplicate id/i);
expect(parseMusicPosts([music(1, { cover: 'missing.jpg' })], () => false)[0].cover).toBe('');
expect(getRecentPosts([music(1)], [perfume(2)])[0].id).toBe('p2');
```

**Step 2: Run tests and verify failure**

Run: `npm run test:unit -- src/lib/content.test.ts`  
Expected: FAIL because `src/lib/content.ts` does not exist.

**Step 3: Implement typed content validation**

Create types `MusicPost`, `PerfumePost`, and `RecentPost`. Export:

```ts
export function parseMusicPosts(
  input: unknown,
  assetExists: (path: string) => boolean = publicAssetExists,
): MusicPost[];

export function parsePerfumePosts(
  input: unknown,
  assetExists: (path: string) => boolean = publicAssetExists,
): PerfumePost[];

export function getRecentPosts(
  music: MusicPost[],
  perfume: PerfumePost[],
  limit = 3,
): RecentPost[];
```

Implementation requirements:

- Accept only arrays.
- Require positive numeric `id` values and reject duplicates within each collection.
- Require `YYYY/MM/DD` dates.
- Require Music `title`, `tag`, and `excerpt` strings.
- Require Perfume `brand`, `name`, `excerpt`, and `scents: string[]`.
- Treat `cover` as optional; return `''` and emit a build warning when `public/<cover>` is absent.
- Map recent IDs to `m<id>` / `p<id>`, sort descending by date, and limit to three by default.
- Import `posts/music.json` and `posts/perfume.json` once and export validated `musicPosts`, `perfumePosts`, and `recentPosts`.

Create `src/config/site.ts`:

```ts
export const SITE = {
  name: 'AllenLin',
  siteUrl: 'https://allenchenhan99.github.io',
  base: '/website/',
  faviconSvg: 'assets/brand/allenlin-icon.svg',
  faviconPng: 'assets/brand/favicon-32.png',
  appleTouchIcon: 'assets/brand/apple-touch-icon.png',
} as const;

export const withBase = (path: string) => `${SITE.base}${path.replace(/^\//, '')}`;
```

**Step 4: Verify tests and type checking**

Run: `npm run test:unit -- src/lib/content.test.ts && npm run check`  
Expected: PASS; empty `posts/perfume.json` remains valid.

**Step 5: Commit**

```bash
git add src/config/site.ts src/lib/content.ts src/lib/content.test.ts
git commit -m "feat: validate content at build time"
```

### Task 3: 整理公開資產並保留管理後台

**Files:**
- Move: `assets/` → `public/assets/`
- Move: `asciiart/` → `public/asciiart/`
- Move: `cv_pdf/` → `public/cv_pdf/`
- Move: `admin.html` → `public/admin.html`
- Move: `admin-preview.html` → `public/admin-preview.html`
- Move: `post-preview.html` → `public/post-preview.html`
- Move: `css/admin.css` → `public/css/admin.css`
- Move: `js/admin.js` → `public/js/admin.js`
- Move: public page CSS files → `src/styles/`
- Create: `scripts/generate-icons.mjs`
- Create: `tests/test_public_assets.py`
- Modify: `package.json`
- Modify: `public/admin.html`
- Modify: `public/js/admin.js`

**Step 1: Write failing asset/admin contracts**

Test that:

- `public/admin.html`, `public/js/admin.js`, `public/css/admin.css` exist.
- `public/assets/brand/allenlin-icon.svg` exists and contains neither `#FEA4FC` nor the removed full-canvas path.
- Admin title contains `AllenLin` and links the shared SVG favicon.
- Admin uses `public/assets/images/uploads` as the GitHub repository upload directory but stores `assets/images/uploads/...` in JSON.
- `favicon-32.png` and `apple-touch-icon.png` exist.

Run: `python3 -m unittest tests.test_public_assets -v`  
Expected: FAIL before the moves and icon generation.

**Step 2: Move assets without changing public URLs**

Use `git mv` for tracked files. Move `style.css`, `profile.css`, `cv.css`, `music.css`, `perfume.css`, and `responsive.css` into `src/styles/`; keep only Admin CSS in `public/css/`.

**Step 3: Separate Admin repository path from public URL**

In `public/js/admin.js`, replace `UPLOAD_DIR` with:

```js
const UPLOAD_REPO_DIR = 'public/assets/images/uploads';
const UPLOAD_PUBLIC_DIR = 'assets/images/uploads';
```

Upload with `UPLOAD_REPO_DIR`. After upload, store the equivalent public path:

```js
const publicPath = finalPath.replace(`${UPLOAD_REPO_DIR}/`, `${UPLOAD_PUBLIC_DIR}/`);
if (this.cropTarget === 'music') this.musicForm.cover = publicPath;
else this.perfumeForm.cover = publicPath;
```

Set Admin title to `Admin | AllenLin` and add the SVG favicon link. Do not change authentication, token storage, content schema, or save paths for `posts/*.json`.

**Step 4: Generate favicon variants deterministically**

Create `scripts/generate-icons.mjs` using Sharp to contain the transparent SVG within 32×32 and 180×180 transparent PNG canvases. Add `"icons": "node scripts/generate-icons.mjs"` and `"prebuild": "npm run icons"` to `package.json`.

Run: `npm run icons`  
Expected: creates `public/assets/brand/favicon-32.png` and `public/assets/brand/apple-touch-icon.png`.

**Step 5: Verify Admin and assets**

Run: `python3 -m unittest tests.test_public_assets -v && npm run build`  
Expected: PASS; `dist/admin.html` and both icon formats exist.

**Step 6: Commit**

```bash
git add package.json package-lock.json public src/styles scripts/generate-icons.mjs tests/test_public_assets.py
git commit -m "refactor: organize public assets and preserve admin"
```

### Task 4: 建立共用 Layout、導覽、Theme 與 AllenLin metadata

**Files:**
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/components/Navigation.astro`
- Create: `src/components/ThemeToggle.astro`
- Create: `src/scripts/theme.ts`
- Create: `tests/test_branding_layout.py`
- Modify: `src/pages/*.astro`

**Step 1: Write failing branding/layout contracts**

Check that BaseLayout:

- Produces `AllenLin` for Home and `<Page> | AllenLin` for inner pages.
- Links SVG, 32px PNG, and Apple Touch Icon through the repository base.
- Runs the theme initialization in `<head>`.
- Renders all five relative `.html` navigation targets and one active state.
- Has one real button with accessible title/label.

Run: `python3 -m unittest tests.test_branding_layout -v`  
Expected: FAIL because the shared components do not exist.

**Step 2: Implement pre-paint theme initialization**

`BaseLayout.astro` must run this inline before styles paint:

```js
try {
  const saved = localStorage.getItem('theme');
  const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
} catch {
  document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
```

`src/scripts/theme.ts` toggles the root `data-theme`, updates `localStorage` when available, updates the icon/text, and never throws when storage is disabled.

**Step 3: Implement shared metadata and navigation**

`BaseLayout` accepts `pageTitle?: string` and `activePage`. Use `SITE` and `withBase` for icons; navigation targets remain `index.html`, `profile.html`, `cv.html`, `music.html`, and `perfume.html`. Preserve the current `.navbar`, `.nav-links`, `.nav-link`, and `.theme-toggle` class names.

Update all placeholder pages to render through BaseLayout and import their current page stylesheet followed by `responsive.css`.

**Step 4: Verify rendered output**

Run: `npm run check && npm run build && python3 -m unittest tests.test_branding_layout -v`  
Expected: PASS; `dist/index.html` title is `AllenLin`, inner titles end in `| AllenLin`, and no public output contains `Vue.createApp`.

**Step 5: Commit**

```bash
git add src/layouts src/components src/scripts/theme.ts src/pages tests/test_branding_layout.py
git commit -m "feat: add AllenLin layout branding and theme"
```

### Task 5: 遷移 Profile 並最佳化固定圖片

**Files:**
- Create: `src/assets/images/IMG_1049.JPG`
- Create: `src/assets/images/selfie.JPG`
- Modify: `src/pages/profile.astro`
- Modify: `src/styles/profile.css`
- Modify: `tests/test_responsive_layout.py`

**Step 1: Adapt responsive tests to the Astro source**

Update the contract to inspect `src/pages/profile.astro`, `src/styles/profile.css`, and `src/styles/responsive.css`. Add assertions that Profile uses Astro `<Picture>`, supplies alt text, and does not use the duplicate `background: url('../assets/images/selfie.JPG')` pseudo-element.

Run: `python3 -m unittest tests.test_responsive_layout -v`  
Expected: FAIL because Profile is still a placeholder.

**Step 2: Copy fixed sources into Astro assets**

Copy the two original JPG files from `public/assets/images/` to `src/assets/images/`. Keep public originals because existing JSON/Admin preview URLs must remain valid.

**Step 3: Migrate Profile markup**

Transfer the current content and classes verbatim into `src/pages/profile.astro`. Replace both image elements/pseudo-background with `<Picture>` using imported images, `formats={['avif', 'webp']}`, responsive layout, explicit alt text, and priority only for the above-the-fold background.

Change the circular avatar CSS from `::before`/`::after` to the real `.profile-photo` element while keeping the same 300/290, 200/190, and 150/140 desktop/tablet/mobile sizes and object position.

**Step 4: Verify page and image output**

Run: `npm run check && npm run build && python3 -m unittest tests.test_responsive_layout -v`  
Expected: PASS; `dist/_astro/` contains optimized Profile images and Profile has no Vue script.

**Step 5: Commit**

```bash
git add src/assets/images/IMG_1049.JPG src/assets/images/selfie.JPG src/pages/profile.astro src/styles/profile.css tests/test_responsive_layout.py
git commit -m "feat: migrate and optimize profile page"
```

### Task 6: 遷移 CV 中英文內容

**Files:**
- Modify: `src/pages/cv.astro`
- Create: `src/scripts/cv-language.ts`
- Modify: `src/styles/cv.css`
- Modify: `tests/test_cv_content.py`

**Step 1: Point CV content tests at Astro and add behavior contracts**

Change `CV_HTML` to `src/pages/cv.astro`. Preserve every existing English/Chinese required and removed-content assertion. Add checks for `data-lang="en"`, `data-lang="zh"`, `cv-lang`, and absence of Vue interpolation (`{{`).

Run: `python3 -m unittest tests.test_cv_content -v`  
Expected: FAIL because the Astro page does not yet contain the CV.

**Step 2: Migrate all approved CV content**

Copy every existing section, link, phone number, date, English string, and Chinese translation into static HTML. Replace each Vue ternary with paired nodes:

```html
<span data-lang="en">English text</span>
<span data-lang="zh" hidden>中文內容</span>
```

Keep exactly one English PDF link and one Chinese PDF link, both prefixed with the deployment base.

**Step 3: Implement language switching**

`src/scripts/cv-language.ts` reads `cv-lang`, defaults to English, toggles every `[data-lang]` node with `hidden`, updates `document.documentElement.lang`, and persists the selected language when storage works. It must catch storage errors.

**Step 4: Verify CV**

Run: `python3 -m unittest tests.test_cv_content -v && npm run check && npm run build`  
Expected: all CV regressions pass and `dist/cv.html` contains both languages without Vue.

**Step 5: Commit**

```bash
git add src/pages/cv.astro src/scripts/cv-language.ts src/styles/cv.css tests/test_cv_content.py
git commit -m "feat: migrate bilingual CV without Vue"
```

### Task 7: 遷移首頁 build-time Recent、ASCII 與 Chipi

**Files:**
- Modify: `src/pages/index.astro`
- Create: `src/scripts/home.ts`
- Modify: `src/styles/style.css`
- Create: `src/scripts/home.test.ts`
- Read: `asciiArt.txt`
- Read: `chipi.txt`

**Step 1: Write failing animation/recent tests**

Extract and test pure helpers:

```ts
expect(buildAsciiFrame(ascii, 0)).toContain(expectedFirstBlock);
expect(buildAsciiFrame(ascii, 25)).toBe(ascii.trimEnd());
expect(splitChipiFrames(lines, 42)).toHaveLength(23);
```

Add build-output contracts requiring three Recent entries in descending date order and no runtime fetch of `posts/*.json` or `asciiArt.txt`.

Run: `npm run test:unit -- src/scripts/home.test.ts`  
Expected: FAIL because helpers do not exist.

**Step 2: Render content at build time**

Use validated `recentPosts`. Import `asciiArt.txt?raw`, `chipi.txt?raw`, and `chipi.txt?url`. Render:

- Empty ASCII `<pre>` plus embedded escaped source for the exact 26-block animation.
- The first 42-line Chipi frame directly inside `<pre id="chipi-animation">`.
- The emitted Chipi URL in `data-chipi-src`.
- Three Recent items and the current category links as static HTML.
- One accessible detail dialog populated from already-rendered Recent content.

**Step 3: Implement efficient animation**

`home.ts` must:

- Keep the existing 100ms ASCII block rhythm.
- Show the complete ASCII immediately for `prefers-reduced-motion`.
- Load the full Chipi asset with `requestIdleCallback` (timeout fallback included).
- Animate with `requestAnimationFrame` throttled near 20ms instead of recursively allocating timers.
- Pause Chipi while `document.hidden`.
- Never delay Recent posts or category rendering.

**Step 4: Verify Home**

Run: `npm run test:unit -- src/scripts/home.test.ts && npm run build`  
Then: `rg -n "fetch\('posts|unpkg.com/vue|Vue.createApp" dist/index.html dist/_astro || true`  
Expected: tests PASS and rg produces no matches.

**Step 5: Commit**

```bash
git add src/pages/index.astro src/scripts/home.ts src/scripts/home.test.ts src/styles/style.css
git commit -m "feat: prerender home content and animations"
```

### Task 8: 遷移 Music、圖片與 lazy Spotify

**Files:**
- Create: `src/assets/images/pxfuel.jpg`
- Create: `src/assets/images/record-player.jpg`
- Create: `src/components/SpotifyEmbed.astro`
- Create: `src/scripts/music.ts`
- Create: `src/scripts/music.test.ts`
- Modify: `src/pages/music.astro`
- Modify: `src/styles/music.css`

**Step 1: Write failing Music interaction tests**

Test the pure view-state helper, iframe creation guard, Spotify fallback timeout, and cover URL resolver. Add output assertions that posts exist in initial HTML, Spotify URLs are in `data-src`, and initial output has no Spotify `<iframe>`.

Run: `npm run test:unit -- src/scripts/music.test.ts`  
Expected: FAIL because Music helpers/components do not exist.

**Step 2: Migrate and optimize fixed Music images**

Copy `pxfuel.jpg` and `record-player.jpg` into `src/assets/images/`. Render the Hero with Astro `<Picture formats={['avif', 'webp']}>`, responsive sizing and priority. Render the record player with optimized `<Image>` and preserve the rotating circular style.

**Step 3: Render posts statically**

Use `musicPosts` to render Grid and List markup at build time. Use real lazy `<img>` elements instead of eager CSS background images; preserve `.grid-cover` sizing and visual styling. Keep one accessible detail dialog and populate it from hidden static post detail nodes.

**Step 4: Implement Spotify intersection loading**

`SpotifyEmbed.astro` renders a 352px reserved container, loading status, direct Spotify fallback link, and `data-src`. `music.ts` observes each embed with `rootMargin: '300px'`, creates an iframe only once, preserves the existing allow/fullscreen attributes, and reveals the fallback after a 12-second load timeout.

Grid/List mode persists to `music-view`; storage failures fall back to Grid.

**Step 5: Verify Music**

Run: `npm run test:unit -- src/scripts/music.test.ts && npm run check && npm run build`  
Expected: PASS; initial `dist/music.html` contains post content and no Spotify iframe element.

**Step 6: Commit**

```bash
git add src/assets/images/pxfuel.jpg src/assets/images/record-player.jpg src/components/SpotifyEmbed.astro src/scripts/music.ts src/scripts/music.test.ts src/pages/music.astro src/styles/music.css
git commit -m "feat: prerender music and defer Spotify embeds"
```

### Task 9: 遷移 Perfume 篩選與 Modal

**Files:**
- Modify: `src/pages/perfume.astro`
- Create: `src/scripts/perfume.ts`
- Create: `src/scripts/perfume.test.ts`
- Modify: `src/styles/perfume.css`

**Step 1: Write failing filter tests**

Test scent options, brand options, All behavior, single-filter behavior, zero-post behavior, and missing-cover placeholder behavior with fixtures independent of the currently empty production JSON.

Run: `npm run test:unit -- src/scripts/perfume.test.ts`  
Expected: FAIL because filter helpers do not exist.

**Step 2: Render static Perfume markup**

Render the existing Hero, mode buttons, sorted filter tags, count, cards, empty state, and detail dialog from `perfumePosts`. Put brand/scents data on each card for client-side filtering; do not fetch JSON in the browser.

**Step 3: Implement filter behavior**

`perfume.ts` changes Scent/Brand modes, rebuilds the appropriate sorted filter buttons, resets active filter to All when mode changes, hides unmatched cards, updates count, and opens/closes the detail dialog. Keep the existing classes and visual styles.

**Step 4: Verify Perfume**

Run: `npm run test:unit -- src/scripts/perfume.test.ts && npm run check && npm run build`  
Expected: PASS with the current empty list and with unit-test fixtures.

**Step 5: Commit**

```bash
git add src/pages/perfume.astro src/scripts/perfume.ts src/scripts/perfume.test.ts src/styles/perfume.css
git commit -m "feat: prerender perfume filters and details"
```

### Task 10: 移除 legacy 公開 runtime 並加入瀏覽器驗證

**Files:**
- Delete: `index.html`
- Delete: `profile.html`
- Delete: `cv.html`
- Delete: `music.html`
- Delete: `perfume.html`
- Delete: `js/app.js`
- Delete: `js/profile.js`
- Delete: `js/cv.js`
- Delete: `js/music.js`
- Delete: `js/perfume.js`
- Create: `playwright.config.ts`
- Create: `tests/e2e/public-pages.spec.ts`
- Modify: `tests/test_astro_architecture.py`
- Modify: `tests/test_responsive_layout.py`

**Step 1: Write failing built-site E2E tests**

Configure Playwright to run `npm run build && npm run preview -- --host 127.0.0.1`, base URL `http://127.0.0.1:4321`, and Chromium. Test:

- All five `/website/*.html` routes return 200 and correct titles.
- No request URL includes `unpkg.com/vue`.
- Theme toggles and persists between pages.
- CV switches English/Chinese.
- Home Recent dialog opens/closes.
- Music has no iframe before the embed approaches the viewport, then creates it after scrolling.
- Music Grid/List toggles.
- Perfume zero-state/filter controls do not throw.
- At 1440×900, 768×1024, and 390×844, `document.documentElement.scrollWidth <= innerWidth`.

Run: `npx playwright install chromium && npm run test:e2e`  
Expected: FAIL until old runtime paths are removed and all interactions are wired.

**Step 2: Remove obsolete public entry points and page scripts**

Delete only the five migrated HTML files and five migrated JS files. Keep `public/admin.html`, `public/js/admin.js`, previews, JSON, source text, and PDFs.

Update architecture contracts to inspect `dist/*.html` after build and assert public output has neither `unpkg.com/vue` nor `Vue.createApp`. Keep Admin explicitly exempt.

**Step 3: Run full local verification**

Run:

```bash
npm run check
npm test
npm run build
npm run test:e2e
```

Expected: all type, unit, contract, build, and browser tests PASS.

**Step 4: Commit**

```bash
git add -A index.html profile.html cv.html music.html perfume.html js src tests playwright.config.ts
git commit -m "test: verify Astro public site end to end"
```

### Task 11: 加入 GitHub Pages CI/CD 與專案說明

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`
- Create: `tests/test_deploy_workflow.py`

**Step 1: Write failing workflow contract**

Assert the workflow runs on PR and `main`, uses Node 24, runs `npm ci`, `npm run check`, `npm test`, `npm run build`, and E2E tests before upload/deploy. Assert deploy has Pages and OIDC permissions.

Run: `python3 -m unittest tests.test_deploy_workflow -v`  
Expected: FAIL because no workflow exists.

**Step 2: Create deployment workflow**

Create `.github/workflows/deploy.yml` with:

```yaml
name: Build and deploy Astro site

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run check
      - run: npm test
      - run: npm run build
      - run: npm run test:e2e
      - if: github.event_name != 'pull_request'
        uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    if: github.event_name != 'pull_request'
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

Ensure the `${{ ... }}` expressions are preserved literally in YAML.

**Step 3: Update README**

Document Node >=22.12, `npm ci`, `npm run dev`, local `/website/` URL, tests, production build, Admin update flow, source JSON paths, public upload repository path, and GitHub Pages deployment.

**Step 4: Verify workflow contract**

Run: `python3 -m unittest tests.test_deploy_workflow -v && npm run verify`  
Expected: PASS.

**Step 5: Commit**

```bash
git add .github/workflows/deploy.yml README.md tests/test_deploy_workflow.py
git commit -m "ci: deploy tested Astro build to Pages"
```

### Task 12: 視覺、效能、localhost、PR 與正式部署

**Files:**
- Modify as needed only when verification finds a demonstrated issue
- Update: `docs/plans/2026-08-28-astro-performance-architecture.md` only if implementation diverges

**Step 1: Run clean verification from lockfile**

Run:

```bash
npm ci
npm run verify
git diff --check
git status --short
```

Expected: all checks PASS; worktree has no unexpected files.

**Step 2: Start the requested localhost frontend**

Run: `npm run dev -- --host 127.0.0.1`  
Expected: Astro reports a local URL under `http://127.0.0.1:4321/website/`. Keep the session running while the user reviews it.

**Step 3: Perform responsive visual comparison**

Compare Home, Profile, CV, Music, and Perfume at 1440×900, 768×1024, and 390×844 against the existing presentation. Check font, color, spacing, image crop, modal, ASCII rhythm, Chipi frames, nav wrapping, and absence of horizontal page scroll. Fix only verified mismatches and rerun the relevant tests.

**Step 4: Measure performance**

Using `@chrome-devtools-mcp:debug-optimize-lcp`, trace Home and Music with Fast 3G and 4× CPU throttling. Confirm:

- LCP < 2.5 seconds.
- CLS < 0.1.
- No public Vue/Unpkg request.
- Initial Music load does not wait for Spotify.
- Static article text is present before client JavaScript executes.

Record before/after numbers in the PR body. If a target fails, diagnose the trace before changing code.

**Step 5: Request code review and create the PR**

Use `@superpowers:requesting-code-review`, address verified findings, rerun `npm run verify`, then:

```bash
git push -u origin feature/astro-performance-architecture
gh pr create --base main --head feature/astro-performance-architecture \
  --title "feat: migrate AllenLin site to Astro" \
  --body-file /tmp/allenlin-astro-pr.md
```

Expected: PR includes design, test evidence, screenshots/visual notes, and performance comparison.

**Step 6: Merge and activate GitHub Actions Pages**

After required checks pass:

```bash
gh pr merge --merge --delete-branch
gh api --method PUT repos/allenchenhan99/website/pages -f build_type=workflow
gh run list --workflow "Build and deploy Astro site" --limit 1
```

Watch the deployment run to completion. If Pages already uses workflow mode, treat the API's no-change response as success.

**Step 7: Verify live production**

Open `https://allenchenhan99.github.io/website/` and all `.html` routes. Confirm `AllenLin` titles, transparent favicon, Admin access, content, interactions, mobile containment, Spotify deferred loading, and the final LCP/CLS budget. Do not remove the worktree until production is confirmed.

**Step 8: Final commit only if verification required fixes**

Stage only the verified fixes, rerun `npm run verify`, and use a focused commit message. Never include the user's `.DS_Store` change.

