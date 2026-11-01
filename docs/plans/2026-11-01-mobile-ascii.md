# Mobile ASCII layout repair

**Goal:** Keep the Home title and Chipi artwork aligned and fully visible across mobile fonts, viewport widths, and minimum font sizes.

**Design:** Bundle an OFL-licensed Noto Sans Mono subset containing every character used by both artworks. Retain the current animation and preferred font sizes. Measure each preformatted block at its actual rendered size and shrink it uniformly inside a dedicated wrapper when necessary; reserve its scaled height and remeasure on resizing and font loading. The wrapper must not hide overflowing text as a substitute for fitting it.

**Alternatives:** A font-only change fixes column alignment but misses minimum font sizes. Converting the animation to SVG or canvas replaces the existing renderer unnecessarily. A bundled font plus measured transforms addresses both failures while retaining the current text renderer.

## Execution

1. Add browser regression tests for equal glyph advances and row starts, actual text bounds across 320–1024px widths, and fitting after text enlargement. Run them against the current implementation and confirm the reported failures.
2. Bundle the font subset and license; add artwork wrappers and a small resize/font-aware fitting controller. Unit-test the scale/height calculation before implementing it. Update obsolete CSS-string and empty-title contract assertions.
3. Run Astro checks, unit and contract tests, and the existing E2E suite. Run the artwork cases on Chromium, Android-style Chromium, WebKit, and Chromium with a 12px minimum font. Inspect screenshots.
4. Review the final diff, commit only this repair, fast-forward main, and push origin/main as requested. Preserve unrelated local files.

## Validation

- `npm run verify`: Astro reports zero diagnostics; 87 unit tests, 70 contract tests, and 29 E2E tests pass.
- The browser cases cover actual glyph advances and text bounds at 320, 360, 390, 430, 768, and 1024px, including a 12px minimum font and a live change to 24px artwork text.
- Chromium and WebKit screenshots at 390px retain the complete aligned title and Chipi frame.
- The bundled 1,316-byte WOFF2 contains all 17 artwork characters with equal advances.
