# Unified Admin Categories Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Journal and Research to the GitHub-backed `/admin/` Content Desk so all four site categories can be edited, deleted, and published from one entry point.

**Architecture:** Extend the browser GitHub client to load and publish `src/data/articles.json` alongside the existing post collections. Add an article tab and form to the existing static admin UI, filtering the shared article collection by Journal/Research while preserving drafts and the other type during writes. Keep the local article page as compatibility surface.

**Tech Stack:** Static HTML/CSS/ES modules, GitHub Contents and Git Data APIs, Vitest, Python contract tests, Astro build.

---

### Task 1: Lock down GitHub client article collection behavior

**Files:**
- Modify: `src/lib/admin-github-client.test.js`
- Modify: `public/admin/github-client.js`

**Step 1: Write failing tests**

Add tests that `loadContent()` reads `src/data/articles.json` at the same revision and returns `articles`; an article upsert writes that path with a string UUID unchanged; and an article conflict rejects without creating blobs or commits.

**Step 2: Run tests to verify failure**

Run: `npx vitest run src/lib/admin-github-client.test.js`

Expected: FAIL because the client currently loads only `perfume` and `music` and rejects `articles` as an unsupported type.

**Step 3: Implement minimal client support**

Add `articles` to `loadContent()` and the publication config with path `src/data/articles.json`, a title-based commit label, and a slug based on the article slug. Generalize ID matching so numeric post IDs and string article IDs both survive upsert and conflict checks; keep new numeric IDs for the existing collections and require/use a string UUID for articles supplied by the form.

**Step 4: Run tests to verify pass**

Run: `npx vitest run src/lib/admin-github-client.test.js`

Expected: PASS.

**Step 5: Commit**

```sh
git add src/lib/admin-github-client.test.js public/admin/github-client.js
git commit -m "feat: publish articles through github admin client"
```

### Task 2: Add article editor markup and styling to Content Desk

**Files:**
- Modify: `public/admin/index.html`
- Modify: `public/admin/admin.css`

**Step 1: Write failing contract assertions**

Extend the admin architecture contract to require Journal and Research tabs, one article form with the existing article field names, and the article delete/publish controls in both source and built admin output.

**Step 2: Run the focused contract test**

Run: `python3 -m unittest tests.test_astro_architecture.AstroArchitectureTest.test_admin_runtime_is_published_in_an_isolated_pages_directory -v`

Expected: FAIL until the markup and generated copy contain the new controls.

**Step 3: Implement markup and styles**

Add Journal and Research tab buttons, an article form with shared metadata, type-specific fields, Markdown body, preview-friendly labels, and publish/delete actions. Add styles that reuse the existing grid and form system while giving the article form enough room for long Markdown content and keeping mobile layout usable.

**Step 4: Run the focused contract test**

Run: `python3 -m unittest tests.test_astro_architecture.AstroArchitectureTest.test_admin_runtime_is_published_in_an_isolated_pages_directory -v`

Expected: PASS.

**Step 5: Commit**

```sh
git add public/admin/index.html public/admin/admin.css tests/test_astro_architecture.py
git commit -m "feat: add journal and research admin forms"
```

### Task 3: Connect article form state and publishing actions

**Files:**
- Modify: `public/admin/admin.js`
- Modify: `public/admin/index.html`

**Step 1: Write failing behavior tests**

Add DOM-light tests or exported pure helper tests for article payload normalization: ISO date and UUID IDs are retained, topic options follow Journal/Research type, and the list displays only the selected article type.

**Step 2: Run tests to verify failure**

Run: `npx vitest run src/lib/admin-github-client.test.js src/lib/article-admin.test.js`

Expected: FAIL because the unified admin runtime has no article state, payload, or tab behavior.

**Step 3: Implement minimal runtime behavior**

Track `articles` in state, render Journal/Research lists from the shared collection, reset and fill the article form, update type-specific fields, build a validated payload, and route article upsert/delete through `state.client.publish('articles', ...)`. Refresh all collections from the returned commit SHA and preserve the current toast, busy, and conflict behavior. Use a browser-safe Markdown preview renderer already present in the project or add the smallest isolated renderer needed by the admin page.

**Step 4: Run tests to verify pass**

Run: `npx vitest run src/lib/admin-github-client.test.js src/lib/article-admin.test.js`

Expected: PASS.

**Step 5: Commit**

```sh
git add public/admin/admin.js public/admin/index.html src/lib/article-admin.test.js
git commit -m "feat: wire article editing into unified admin"
```

### Task 4: Update entry points and documentation

**Files:**
- Modify: `public/admin/index.html`
- Modify: `README.md`
- Modify: `tests/test_astro_architecture.py`

**Step 1: Add failing documentation/entry assertions**

Assert that the main admin links describe all four editable categories and that generated admin output no longer presents Journal/Research as a separate required workflow.

**Step 2: Run the focused contract test**

Run: `python3 -m unittest tests.test_astro_architecture -v`

Expected: FAIL until links and documentation are updated.

**Step 3: Update links and docs**

Point login and topbar navigation at the unified Content Desk, document the four-category GitHub workflow, and explain that the local article page is a compatibility preview rather than the primary publishing path.

**Step 4: Run the focused contract test**

Run: `python3 -m unittest tests.test_astro_architecture -v`

Expected: PASS.

**Step 5: Commit**

```sh
git add public/admin/index.html README.md tests/test_astro_architecture.py
git commit -m "docs: document unified admin workflow"
```

### Task 5: Run complete verification

**Files:** None beyond generated `dist/` output.

**Step 1: Run typecheck and unit tests**

Run: `npm run check && npm run test:unit`

Expected: PASS with no TypeScript or Vitest failures.

**Step 2: Run contracts and build**

Run: `npm run test:contracts && npm run build`

Expected: PASS and `dist/admin/` contains the updated isolated admin runtime.

**Step 3: Run browser tests**

Run: `npm run test:e2e`

Expected: PASS.

**Step 4: Review the final diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only intended source, test, and plan changes are present.
