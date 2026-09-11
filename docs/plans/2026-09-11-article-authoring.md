# Article Authoring Implementation Plan

**Goal:** Preserve the approved Journal/Research card design and make articles durable and ready to author locally.

**Architecture:** Store validated articles in a project JSON file outside public assets. A localhost-only development endpoint reads and writes it with revision checking. Build only published entries into static card lists and per-article URLs. The local editor saves drafts to the project. Deployment remains a separate GitHub workflow action.

**Tech Stack:** Astro, TypeScript, Node filesystem, Vitest, Playwright.

1. Add validated article storage, atomic writes and revision conflicts; test invalid metadata and duplicate identities.
2. Add the development-only endpoint with host/origin checks and bounded request bodies.
3. Render published cards and permanent article pages during build; preserve filters, layouts, themes and metadata. Never ship drafts or examples in client bundles.
4. Connect the editor to project storage with explicit saved/publish-ready feedback and starter templates.
5. Verify save/reload, draft exclusion, revision conflict, article links, typecheck and build. Keep the preview open locally; no deployment in this pass.

## Music follow-up
The user also approved text cards for Music. Use full-width album artwork above the text in grid cards, larger side artwork in list rows, and the Journal card spacing and title hierarchy. Retain cover art inside the detail dialog. Keep existing view preference and playlist behavior.
