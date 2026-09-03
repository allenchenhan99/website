from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ADMIN_HTML = PUBLIC / "admin.html"
WORKER_PUBLIC = ROOT / "workers" / "admin" / "public"
WORKER_HTML = WORKER_PUBLIC / "index.html"
WORKER_JS = WORKER_PUBLIC / "admin.js"
ICON_SVG = PUBLIC / "assets" / "brand" / "allenlin-icon.svg"
REMOVED_FULL_CANVAS_PATH = "M0 0 C211.2 0 422.4"
FOREGROUND_SIGNATURE = "M0 0 C0.67885254 0.4851709"
APPROVED_PATH_COUNT = 140


class PublicAssetsTest(unittest.TestCase):
    def test_secure_admin_assets_exist(self):
        for path in (WORKER_HTML, WORKER_JS, WORKER_PUBLIC / "admin.css"):
            with self.subTest(path=path):
                self.assertTrue(path.exists())

    def test_brand_icon_is_transparent_and_without_removed_canvas_path(self):
        content = ICON_SVG.read_text(encoding="utf-8")
        self.assertNotIn("#FEA4FC", content)
        self.assertNotIn(REMOVED_FULL_CANVAS_PATH, content)
        self.assertIn(FOREGROUND_SIGNATURE, content)
        self.assertEqual(content.count("<path "), APPROVED_PATH_COUNT)

    def test_legacy_admin_redirects_without_collecting_a_github_token(self):
        content = ADMIN_HTML.read_text(encoding="utf-8")
        self.assertIn("<title>Admin | AllenLin</title>", content)
        self.assertIn("allenlin-content-admin", content)
        self.assertIn('http-equiv="refresh"', content)
        self.assertNotIn("Personal Access Token", content)
        self.assertNotIn("unpkg.com", content)

    def test_secure_admin_never_handles_a_browser_github_token(self):
        combined = "\n".join(
            path.read_text(encoding="utf-8") for path in (WORKER_HTML, WORKER_JS)
        )
        self.assertNotIn("localStorage", combined)
        self.assertNotIn("github token", combined.lower())
        self.assertNotIn("unpkg.com", combined)

    def test_perfume_editor_has_the_complete_current_schema(self):
        html = WORKER_HTML.read_text(encoding="utf-8")
        script = WORKER_JS.read_text(encoding="utf-8")
        for field in (
            "title",
            "content",
            "scents",
            "notes-top",
            "notes-middle",
            "notes-base",
            "longevity",
            "presence",
            "sweetness",
            "warmth",
            "complexity",
            "dailyWearability",
            "source",
        ):
            with self.subTest(field=field):
                self.assertIn(f'name="{field}"', html)
        self.assertIn('step="0.5"', html)
        self.assertIn("drawRadar", script)
        self.assertGreaterEqual(script.count("form.dataset.cover = '';"), 2)
        self.assertNotIn("new Date().toISOString()", script)
        self.assertIn("revision: state.revision", script)
        self.assertIn('id="clear-perfume-image"', html)
        self.assertIn('id="clear-music-image"', html)

    def test_png_favicon_variants_are_published(self):
        for filename in ("favicon-32.png", "apple-touch-icon.png"):
            with self.subTest(filename=filename):
                self.assertTrue((PUBLIC / "assets" / "brand" / filename).exists())


if __name__ == "__main__":
    unittest.main()
