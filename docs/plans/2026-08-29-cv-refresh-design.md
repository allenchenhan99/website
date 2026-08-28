# CV Refresh Design

## Goal

Update the public CV page from `Lin_Chen_Han_CV_New.pdf` while preserving the existing visual design and bilingual browsing experience.

## Source of truth

The new English PDF is authoritative for dates, English wording, included projects, and ordering. The Chinese web copy will be translated to match the new English source. The existing Chinese PDF remains available and is intentionally not regenerated as part of this change.

## Page changes

- Keep the current Astro layout, language toggle, timeline components, styles, and responsive behavior.
- Update the Whale Force internship period from `2026/03 – Present` to `2026/03 – 2026/07`.
- Replace the internship summary with the new Systematic Strategy Research, Financial Statement Parsing, and Institutional Portfolio Research details.
- Rename and date the LoRA project according to the new PDF.
- Update and date the Pima Indian Diabetes project according to the new PDF.
- Remove the Game Theory Applied to Darts Strategies project because it is absent from the new source.
- Apply matching Chinese translations to the web page.

## PDF behavior

- Replace `public/cv_pdf/English_CV.pdf` with the supplied new English PDF.
- Keep `public/cv_pdf/Chinese_CV.pdf` unchanged.
- English mode continues to link to the refreshed English PDF.
- Chinese mode continues to link to the existing Chinese PDF, as explicitly requested.

## Verification

- Add contract assertions for the new dates, internship evidence, updated project names, and removal of the darts project.
- Assert that the English and Chinese buttons still resolve to their respective PDF files.
- Run the CV contract tests, then the full project verification suite.
- Render and inspect the supplied English PDF; verify the copied public artifact has the same checksum and remains a readable two-page PDF.
- Check the built CV page in both languages and at responsive widths without redesigning the page.
