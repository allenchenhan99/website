# Responsive Layout Design

## Goal

Make every public page adapt fluidly across phone, tablet, laptop, and desktop widths while preserving the site's existing monochrome monospace visual identity. The homepage ASCII art and Chipi animation must remain intact without forcing horizontal page scrolling.

## Scope

- Apply shared responsive behavior to `index.html`, `profile.html`, `cv.html`, `music.html`, and `perfume.html`.
- Keep existing content, theme switching, language switching, filters, view toggles, animations, and modal behavior.
- Add a shared responsive stylesheet loaded after each page's existing stylesheet.
- Do not redesign the admin and preview-only pages in this pass.

## Layout Strategy

Create `css/responsive.css` as a focused override layer. It will centralize cross-page rules for viewport containment, fluid spacing and type, navigation wrapping, media sizing, grid changes, and mobile modal layout. Existing page styles remain the source of page-specific colors and composition.

Use fluid values with `clamp()` where continuous scaling is useful, supplemented by a small number of content-driven breakpoints. Containers will remain centered and use flexible inline gutters. Images and cards will be constrained to their containing block instead of relying on fixed pixel proportions.

## Navigation

At narrow widths, keep the full navigation visible and allow its links to wrap naturally into two rows. The theme control remains reachable at the right edge. Link size and spacing may reduce moderately, but touch targets must stay usable and labels must not be truncated.

## ASCII Content

Preserve `white-space: pre` so the drawings are never reflowed. Replace the current fixed mobile font jumps and horizontal scrolling with a viewport-relative font size capped at the current desktop scale. Both ASCII containers will occupy the available content width and hide no intended characters. The result must fit at the smallest supported viewport without page-level or component-level horizontal scrolling.

## Page-Specific Adaptation

- Home: fluid ASCII, animation, content spacing, recent cards, categories, and mobile detail modal.
- Profile: fluid hero and profile images, readable text measure, and stacked content on small screens.
- CV: fluid header, contact/action wrapping, compact timeline spacing, and wrapping tags without clipping.
- Music: responsive hero overlay and record art, playlist/post grids, list cards, and detail modal.
- Perfume: responsive hero, filter controls, featured card, product grid, and detail modal.

## Verification

- Add automated regression checks for shared stylesheet inclusion and critical overflow-prevention rules before implementation.
- Run the existing CV test suite and the new responsive tests.
- Serve the static site on localhost and inspect every public page at 320, 375, 390, 768, 1024, and 1440 pixel viewport widths.
- Confirm `document.documentElement.scrollWidth <= document.documentElement.clientWidth` on each page and target width.
- Confirm the ASCII and Chipi elements have no horizontal overflow.
- Check that navigation wrapping, theme switching, page interactions, and modal scrolling still work.

## Local Preview

Run a temporary static web server from the repository root and expose it at `http://localhost:8000` for review. The server is a preview aid only and is not part of the deployed site.
