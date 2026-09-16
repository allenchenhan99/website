# Admin Category Unification Design

## Goal

Make Journal and Research editable from the same `/admin/` Content Desk as
Perfume and Music. All four content categories should use the existing GitHub
Contents API workflow so edits, deletes, conflict checks, and deployment
commits behave consistently.

## Architecture

Keep the static admin application in `public/admin/`. Add Journal and Research
as tabs backed by the existing `src/data/articles.json` collection. Extend
`GitHubAdminClient.loadContent()` to read all three JSON collections at one
revision and extend `publish()` with an `articles` collection configuration
using `src/data/articles.json`.

The browser state will keep `articles` alongside `perfume` and `music`. The
article tab will filter the shared collection by `type`, while upsert and
delete requests operate on the full collection so the other article category
and drafts are preserved. Article IDs remain strings, unlike the numeric IDs
used by Perfume and Music.

## Editor behavior

The article form will replace the local-only editor as the production admin
surface. It will expose the existing article fields: type, topic, title, slug,
summary, date, status, featured, research stage/link, competition event/role,
and Markdown body. Type-specific fields and topic options will follow the
existing validation rules. New entries get a UUID and today's ISO date; edits
retain their IDs. The article preview will render Markdown using the existing
browser-safe renderer or a small equivalent bundled into the admin runtime.

The old `admin-articles.html` route remains available as a local authoring
compatibility page during this change, but the main admin links will point to
the unified tabs. Its local-only notice will remain accurate and it will not
be used by GitHub publication.

## Publication and errors

Article upserts write one formatted `src/data/articles.json` blob and create a
single GitHub commit, just like the current post collections. No article image
upload is needed. Existing revision and entry-level conflict detection will be
generalized to string IDs and reused for all collections. Successful writes
refresh all collections from the returned commit SHA; errors leave the form
values intact and show the existing toast feedback.

## Validation

Add client tests proving that article content is loaded at the same revision,
article upserts target `src/data/articles.json`, string IDs are preserved, and
conflicting article edits are rejected without writes. Add focused DOM-free
helpers for article payload normalization if needed. Run the existing unit,
contract, typecheck, build, and E2E suites after implementation.
