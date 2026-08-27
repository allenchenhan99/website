# Responsive Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make all public pages fluid across phone, tablet, and desktop widths, with wrapping navigation and ASCII content that never requires horizontal scrolling.

**Architecture:** Add one shared `css/responsive.css` override layer after each page-specific stylesheet. Keep all page-specific colors and content in place, centralize only cross-page responsive rules, and cover the integration with lightweight Python contract tests plus browser viewport checks.

**Tech Stack:** Static HTML5, CSS3 (`clamp`, grid, flexbox, media queries), Vue 3 CDN, Python `unittest`, local Python HTTP server.

---

### Task 1: Add Responsive Contract Tests

**Files:**
- Create: `tests/test_responsive_layout.py`

**Step 1: Write the failing test**

Create a test that requires every public page to load the shared stylesheet last and records the critical non-overflow/navigation contracts:

```python
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_PAGES = (
    "index.html",
    "profile.html",
    "cv.html",
    "music.html",
    "perfume.html",
)
RESPONSIVE_CSS = ROOT / "css" / "responsive.css"


class ResponsiveLayoutTest(unittest.TestCase):
    def test_public_pages_load_shared_responsive_styles_last(self):
        for page in PUBLIC_PAGES:
            content = (ROOT / page).read_text(encoding="utf-8")
            stylesheets = re.findall(r'<link rel="stylesheet" href="([^"]+)">', content)
            with self.subTest(page=page):
                self.assertEqual(stylesheets[-1], "css/responsive.css")

    def test_shared_styles_define_viewport_containment(self):
        self.assertTrue(RESPONSIVE_CSS.exists())
        content = RESPONSIVE_CSS.read_text(encoding="utf-8")
        for rule in (
            "overflow-x: clip",
            "flex-wrap: wrap",
            ".ascii-art",
            ".chipi-animation",
            "white-space: pre",
            "@media screen and (max-width: 768px)",
            "@media screen and (max-width: 480px)",
        ):
            with self.subTest(rule=rule):
                self.assertIn(rule, content)


if __name__ == "__main__":
    unittest.main()
```

**Step 2: Run the test to verify it fails**

Run: `python3 -m unittest tests.test_responsive_layout -v`

Expected: FAIL because the pages do not yet load `css/responsive.css` and the file does not exist.

**Step 3: Commit the failing test**

```bash
git add tests/test_responsive_layout.py
git commit -m "test: define responsive layout contracts"
```

### Task 2: Add the Shared Responsive Layer

**Files:**
- Create: `css/responsive.css`
- Modify: `index.html:7-8`
- Modify: `profile.html:7-8`
- Modify: `cv.html:7-8`
- Modify: `music.html:7-8`
- Modify: `perfume.html:7-8`

**Step 1: Load the shared stylesheet last**

Add this immediately after each page-specific stylesheet:

```html
<link rel="stylesheet" href="css/responsive.css">
```

**Step 2: Add the cross-page responsive foundation**

Create `css/responsive.css` with these rule groups:

```css
:root {
    --page-gutter: clamp(16px, 4vw, 40px);
    --section-space: clamp(24px, 5vw, 48px);
}

html,
body,
#app {
    max-width: 100%;
}

html,
body {
    overflow-x: clip;
}

img,
svg,
video,
canvas {
    max-width: 100%;
}

.navbar {
    gap: 12px 20px;
    padding-inline: var(--page-gutter);
}

.nav-links {
    min-width: 0;
    flex-wrap: wrap;
    gap: 8px clamp(12px, 2.4vw, 24px);
}

.nav-link {
    line-height: 1.5;
}

.theme-toggle {
    flex: 0 0 auto;
}

.ascii-art,
.chipi-animation {
    width: 100%;
    max-width: 100%;
    overflow-x: clip;
    white-space: pre;
}

.ascii-art {
    font-size: min(9.5px, calc(1.25vw - 0.45px));
}

.chipi-animation {
    font-size: min(9.5px, calc(1.25vw - 0.45px));
}

.detail-modal,
.recent-item,
.category-item,
.playlist-card,
.grid-card,
.featured,
.text-container,
.pdf-card {
    min-width: 0;
}

.detail-text,
.recent-excerpt,
.category-desc,
.timeline-content,
.post-title,
.post-excerpt,
.featured-body,
.grid-body,
.text-container {
    overflow-wrap: anywhere;
}

@media screen and (max-width: 768px) {
    .navbar {
        align-items: flex-start;
        padding: 14px var(--page-gutter);
    }

    .nav-links {
        flex: 1 1 240px;
    }

    .content,
    .cv-wrapper,
    .main,
    .playlists-section,
    .posts-section {
        padding-inline: var(--page-gutter);
    }

    .detail-overlay {
        padding: 12px;
    }

    .detail-body,
    .detail-footer {
        padding-inline: clamp(16px, 5vw, 28px);
    }

    .profile-photo,
    .record-player {
        max-width: 35vw;
        max-height: 35vw;
    }
}

@media screen and (max-width: 480px) {
    .navbar {
        gap: 8px 12px;
    }

    .nav-links {
        column-gap: 14px;
    }

    .nav-link {
        font-size: 12px;
    }

    .theme-toggle {
        padding: 5px 8px;
    }

    .cv-contact,
    .cv-actions,
    .filter-bar,
    .filter-bar-left,
    .posts-header,
    .detail-footer {
        flex-wrap: wrap;
    }

    .timeline {
        padding-left: 12px;
    }

    .timeline-item {
        padding-left: 18px;
    }

    .featured-body,
    .grid-body,
    .playlist-card,
    .text-container {
        padding: clamp(14px, 4vw, 20px);
    }

    .detail-modal {
        max-height: calc(100dvh - 24px);
    }
}
```

Refine page-specific selectors only where browser inspection shows overflow. Do not duplicate existing grid-breakpoint rules already present in the page stylesheets.

**Step 3: Run the responsive contract test**

Run: `python3 -m unittest tests.test_responsive_layout -v`

Expected: PASS.

**Step 4: Run the complete test suite**

Run: `python3 -m unittest discover -s tests -v`

Expected: all responsive and CV content tests pass.

**Step 5: Commit the implementation**

```bash
git add css/responsive.css index.html profile.html cv.html music.html perfume.html
git commit -m "feat: make public pages responsive"
```

### Task 3: Verify Browser Layouts and Refine Edge Cases

**Files:**
- Modify if needed: `css/responsive.css`

**Step 1: Start the temporary preview server**

Run: `python3 -m http.server 8000 --bind 127.0.0.1`

Expected: the site is available at `http://localhost:8000`.

**Step 2: Inspect all target widths**

Open each public page at viewport widths 320, 375, 390, 768, 1024, and 1440 pixels. At every width, evaluate:

```javascript
({
  pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  asciiOverflow: [...document.querySelectorAll('.ascii-art, .chipi-animation')]
    .some((element) => element.scrollWidth > element.clientWidth + 1)
})
```

Expected: both values are `false` on every page and viewport.

**Step 3: Check responsive interactions**

- Confirm navigation links wrap to two rows when required and remain clickable.
- Toggle dark/light mode on every page.
- Toggle both CV languages.
- Switch Music grid/list view and open/close a post modal.
- Change Perfume filters and open/close a fragrance modal.
- Confirm the Home ASCII typing and Chipi animation remain visible.

**Step 4: Make the smallest CSS-only corrections required**

Keep changes in `css/responsive.css`. Do not alter content or JavaScript unless a verified interaction regression requires it.

**Step 5: Re-run all automated tests**

Run: `python3 -m unittest discover -s tests -v`

Expected: all tests pass.

**Step 6: Check the final diff and commit any refinements**

```bash
git diff --check
git add css/responsive.css
git commit -m "fix: refine responsive viewport behavior"
```

Leave the localhost server running so the user can review `http://localhost:8000`.
