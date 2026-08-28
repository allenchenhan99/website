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

Pull requests run checks, unit/contracts, a production build, and Playwright E2E tests without deploying. Pushes to `main` and manually dispatched runs execute the same validation, upload `dist`, and deploy it to GitHub Pages at <https://allenchenhan99.github.io/website/>. In repository settings, GitHub Pages must use **GitHub Actions** as its source.
