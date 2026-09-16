# AllenLin

AllenLin is a statically generated Astro site. Public pages ship prerendered HTML and small native scripts; the Admin page remains a separate legacy Vue tool for editing repository content.

Live site: <https://allenchenhan99.github.io/website/>

## Local development

Requirements: Node.js 22.12 or newer and npm (the repository pins the expected npm release in `package.json`).

```sh
npm ci
npm run dev
```

Open <http://localhost:4321/website/>. The project uses `/website` as its base path so local and GitHub Pages links behave the same way.

Useful commands:

```sh
npm run check        # Astro and TypeScript checks
npm test             # unit and Python contract tests
npm run build        # production output in dist/
npm run test:e2e     # browser tests against a production build
npm run verify       # all checks, tests, build, and browser tests
npm run preview      # preview dist/ locally
```

## Content and Admin

- `posts/music.json` and `posts/perfume.json` are the source of public post content. Astro validates and prerenders them during the build.
- The deployed `/website/admin.html` tool reads and writes those files through the GitHub Contents API. It requires a GitHub token with access to this repository and intentionally remains separate from the Astro public-page runtime.
- Cropped Admin images are committed to `public/assets/images/uploads`; JSON stores their public path as `assets/images/uploads/...`. Uploading an image and saving a post are separate repository updates, so complete both actions when adding a cover.
- The source brand icon is `public/assets/brand/allenlin-icon.svg`. Replace it with a transparent, square-friendly SVG, then run `npm run icons` (or `npm run build`) to regenerate `favicon-32.png` and `apple-touch-icon.png` in the same directory.

## CI and GitHub Pages

Pull requests run checks, unit/contracts, a production build, and Playwright E2E tests without deploying. Pushes to `main` execute the same validation, upload `dist`, and deploy it to GitHub Pages at <https://allenchenhan99.github.io/website/>. Manual runs deploy only when dispatched from `main`; other selected refs run validation without uploading or deploying. Pull request validation is isolated from release runs. Running releases are not canceled, and deployment jobs serialize through a shared production group; GitHub Actions may replace an older pending run when a newer run enters the same concurrency group. In repository settings, GitHub Pages must use **GitHub Actions** as its source.

## Admin authoring

Open `/website/admin/` (or `/website/admin.html`) to edit all four content categories: Perfume, Music, Journal and Research. The Content Desk uses a fine-grained GitHub token, reads each collection at one repository revision, and publishes an edit or delete as one commit that starts the normal Pages deployment.

Journal and Research entries are stored in `src/data/articles.json`. Choose the category tab, fill in the metadata and Markdown body, then publish as a draft or published entry. Published entries generate `/website/journal/<slug>.html` or `/website/research/<slug>.html`; drafts stay out of generated website files while remaining visible in repository source.

The old `/website/admin-articles.html` page remains as a localhost-only authoring preview for compatibility. It does not push to GitHub and is no longer required for the publishing workflow. The GitHub-backed Content Desk detects conflicting saves from another window and preserves the unsaved form on failure.
