# CV Content Sync Design

## Goal

Synchronize the website CV content with `cv_pdf/English_CV.pdf`, using the new English PDF as the factual source for both language modes.

## Scope

- Update the English content in `cv.html` to match the new PDF.
- Translate the same facts into Traditional Chinese for the Chinese language mode.
- Preserve the current layout, theme switching, language switching, and PDF download behavior.
- Keep `cv_pdf/Chinese_CV.pdf` unchanged because no new Chinese PDF was provided.

## Content Structure

The page will contain these sections, in this order:

1. Education
2. Master's Thesis
3. Internship Experience
4. Projects
5. Selected Honors & Competitions
6. Technical Skills
7. PDF Download

The header subtitle will describe the completed M.S. degree instead of calling the owner a current master's student.

## Synchronization Rules

- Treat the new English PDF as the source of truth.
- Preserve names, dates, rankings, metrics, and technologies from the PDF.
- Translate meaning rather than wording literally when producing Traditional Chinese.
- Remove website-only entries that are absent from the new PDF: research assistant, math tutor, OpenGL ocean project, housing-price competition, and extracurricular darts-club section.
- Keep existing contact and external-link behavior unless the PDF provides a clearly resolvable replacement.

## Verification

- Confirm every PDF section and entry appears in both language modes.
- Confirm removed entries no longer appear in `cv.html`.
- Validate JavaScript syntax and HTML/Vue binding structure.
- Render the page locally at desktop and mobile widths and inspect both languages.
- Verify both PDF links still point to the existing stable filenames.
