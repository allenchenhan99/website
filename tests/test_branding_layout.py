from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
LAYOUT = ROOT / "src" / "layouts" / "BaseLayout.astro"
NAVIGATION = ROOT / "src" / "components" / "Navigation.astro"
THEME_TOGGLE = ROOT / "src" / "components" / "ThemeToggle.astro"
THEME_SCRIPT = ROOT / "src" / "scripts" / "theme.ts"
PAGES = {
    "index": None,
    "profile": "Profile",
    "cv": "CV",
    "music": "Music",
    "perfume": "Perfume",
}
NAV_TARGETS = (
    "index.html",
    "cv.html",
    "music.html",
    "perfume.html",
)


class BrandingLayoutTest(unittest.TestCase):
    def test_layout_defines_allenlin_titles_and_base_aware_brand_icons(self):
        self.assertTrue(LAYOUT.exists())
        content = LAYOUT.read_text(encoding="utf-8")

        self.assertIn("SITE.name", content)
        self.assertIn("pageTitle ? `${pageTitle} | ${SITE.name}` : SITE.name", content)
        self.assertIn("withBase(SITE.faviconSvg)", content)
        self.assertIn("withBase(SITE.faviconPng)", content)
        self.assertIn("withBase(SITE.appleTouchIcon)", content)

    def test_layout_initializes_theme_in_head_before_styles(self):
        self.assertTrue(LAYOUT.exists())
        content = LAYOUT.read_text(encoding="utf-8")

        theme_script = content.index("localStorage.getItem('theme')")
        stylesheet = content.index('<slot name="styles"')
        self.assertLess(theme_script, stylesheet)
        self.assertIn("matchMedia('(prefers-color-scheme: dark)').matches", content)
        self.assertIn("document.documentElement.dataset.theme", content)
        self.assertIn("} catch {", content)

    def test_navigation_preserves_relative_targets_and_active_page(self):
        self.assertTrue(NAVIGATION.exists())
        content = NAVIGATION.read_text(encoding="utf-8")

        for target in NAV_TARGETS:
            with self.subTest(target=target):
                self.assertIn(f'"{target}"', content)
        self.assertNotIn('{ id: "profile"', content)
        self.assertIn('class:list={["nav-link", { active: activePage === item.id }]}', content)
        self.assertIn('class="navbar"', content)
        self.assertIn('class="nav-links"', content)

    def test_theme_toggle_is_one_accessible_real_button_with_safe_storage(self):
        self.assertTrue(THEME_TOGGLE.exists())
        self.assertTrue(THEME_SCRIPT.exists())
        component = THEME_TOGGLE.read_text(encoding="utf-8")
        script = THEME_SCRIPT.read_text(encoding="utf-8")

        self.assertEqual(len(re.findall(r"<button\b", component)), 1)
        self.assertIn('class="theme-toggle"', component)
        self.assertIn('aria-label="Switch to light mode"', component)
        self.assertIn('title="Switch to light mode"', component)
        self.assertIn("localStorage.setItem('theme'", script)
        self.assertIn("try {", script)
        self.assertIn("catch", script)
        self.assertIn("document.documentElement.dataset.theme", script)

    def test_pages_use_shared_layout_with_page_css_before_responsive_css(self):
        styles = {
            "index": "style.css",
            "profile": "profile.css",
            "cv": "cv.css",
            "music": "music.css",
            "perfume": "perfume.css",
        }
        for page, page_title in PAGES.items():
            with self.subTest(page=page):
                content = (ROOT / "src" / "pages" / f"{page}.astro").read_text(
                    encoding="utf-8"
                )
                self.assertIn('import BaseLayout from "../layouts/BaseLayout.astro"', content)
                self.assertIn(f'import "../styles/{styles[page]}"', content)
                self.assertIn('import "../styles/responsive.css"', content)
                self.assertIn(f'activePage="{page}"', content)
                if page_title is None:
                    self.assertNotIn("pageTitle=", content)
                else:
                    self.assertIn(f'pageTitle="{page_title}"', content)


if __name__ == "__main__":
    unittest.main()
