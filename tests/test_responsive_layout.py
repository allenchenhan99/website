from pathlib import Path
import re
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
PUBLIC_PAGES = ("index", "profile", "cv", "music", "perfume")
RESPONSIVE_CSS = ROOT / "src" / "styles" / "responsive.css"
PROFILE_PAGE = ROOT / "src" / "pages" / "profile.astro"
PROFILE_CSS = ROOT / "src" / "styles" / "profile.css"


class ResponsiveLayoutTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(
            ["npm", "run", "build"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )

    def test_astro_pages_import_shared_responsive_styles_last(self):
        for page in PUBLIC_PAGES:
            content = (ROOT / "src" / "pages" / f"{page}.astro").read_text(
                encoding="utf-8"
            )
            style_imports = re.findall(r'import "../styles/([^"]+\.css)";', content)
            with self.subTest(page=page):
                self.assertEqual(style_imports[-1], "responsive.css")

    def test_fresh_public_build_contains_styles_with_base_aware_asset_links(self):
        for page in PUBLIC_PAGES:
            content = (DIST / f"{page}.html").read_text(encoding="utf-8")
            stylesheets = re.findall(r'<link rel="stylesheet" href="([^"]+)">', content)
            with self.subTest(page=page):
                self.assertTrue(stylesheets or "<style>" in content)
                self.assertTrue(all(href.startswith("/website/") for href in stylesheets))

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

    def test_ascii_scale_includes_breakpoint_safety_margin(self):
        content = RESPONSIVE_CSS.read_text(encoding="utf-8")
        self.assertIn("calc(1.25vw - 0.55px)", content)

    def test_profile_uses_optimized_astro_images_without_css_avatar_source(self):
        page = PROFILE_PAGE.read_text(encoding="utf-8")
        profile_css = PROFILE_CSS.read_text(encoding="utf-8")
        responsive_css = RESPONSIVE_CSS.read_text(encoding="utf-8")

        self.assertIn('import { Picture } from "astro:assets";', page)
        self.assertIn("<Picture", page)
        self.assertIn("formats={['avif', 'webp']}", page)
        self.assertIn('alt="Background Photo"', page)
        self.assertIn('alt="Profile Photo"', page)
        self.assertNotIn("background: url('../assets/images/selfie.JPG')", profile_css)
        self.assertIn(".profile-photo", profile_css)
        self.assertIn(".image-container .profile-photo", responsive_css)
        self.assertRegex(
            profile_css,
            r"\.profile-photo img\s*\{[^}]*object-position:\s*25% 58%;[^}]*transform-origin:\s*25% 58%;[^}]*transform:\s*scale\(1\.25\);",
        )


if __name__ == "__main__":
    unittest.main()
