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
            stylesheets = re.findall(
                r'<link rel="stylesheet" href="([^"]+)">', content
            )
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

    def test_ascii_scale_includes_breakpoint_safety_margin(self):
        content = RESPONSIVE_CSS.read_text(encoding="utf-8")
        self.assertIn("calc(1.25vw - 0.55px)", content)


if __name__ == "__main__":
    unittest.main()
