# Journal and Research Local Preview Implementation Plan

**Goal:** Let Allen review Journal, Research, article reading, and article administration on localhost before connecting publishing.

**Architecture:** Reuse Astro navigation and theme. Share typed sample articles and browser-local draft storage across listing, article, and editor pages. Sample content and storage interactions are restricted to localhost. The existing GitHub-backed music/perfume editor remains intact; a link opens the article editor. No remote writes, commits, or deployment.

**Tech Stack:** Astro, TypeScript, CSS, localStorage, Vitest, Playwright.

## Revised local design for review
- Match the existing Music and Perfume categories: photographic hero, inset introduction, monospace typography, bordered cards, filter chips and grid/list controls.
- Journal: newest-first text cards, competition and weekly-note filters; desktop three-column grid and mobile single column.
- Research: use the same card structure, with topic, status, date and featured metadata.
- Hero images are AI-generated atmospheric illustrations, not photos documenting actual events or research.
- Article: narrow reading column, metadata, headings, code blocks, reference links.
- Content Desk: article library, common metadata, type-specific fields, Markdown editor and preview, local draft/published states.
- Navigation: preserve Home (already includes Profile), add Research and Journal before CV; a native mobile disclosure handles the longer navigation.

## Implementation
1. Add a typed article model, clearly labeled demo entries, local storage validation and safe Markdown preview; test draft visibility and unsafe text rendering.
2. Add Journal, Research and article routes; integrate navigation and responsive styles.
3. Add the local article editor and an entry point from existing administration. Save and preview must work without a GitHub token; communicate browser-local scope.
4. Run typecheck, unit tests, build; exercise filters, editing, saving, reloading, article navigation and mobile overflow in Chromium.
5. Start a localhost dev server and open the public list and article editor for review.

## Follow-up
Project-backed local authoring and static published routes are implemented in `2026-09-11-article-authoring.md`. The browser-only storage described above records the original prototype and is now superseded.

## Originally deferred
Remote GitHub writes, image upload, full Markdown/math support, static routes for actual authored articles, and production publishing require the next implementation pass after UI review.
