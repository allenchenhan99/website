from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ADMIN_HTML = PUBLIC / "admin.html"
ADMIN_APP = PUBLIC / "admin"
ADMIN_APP_HTML = ADMIN_APP / "index.html"
ADMIN_APP_JS = ADMIN_APP / "admin.js"
ADMIN_GITHUB_CLIENT = ADMIN_APP / "github-client.js"
ADMIN_IMAGE_CROP = ADMIN_APP / "image-crop.js"
ICON_SVG = PUBLIC / "assets" / "brand" / "allenlin-icon.svg"
REMOVED_FULL_CANVAS_PATH = "M0 0 C211.2 0 422.4"
FOREGROUND_SIGNATURE = "M0 0 C0.67885254 0.4851709"
APPROVED_PATH_COUNT = 140


class PublicAssetsTest(unittest.TestCase):
    def test_github_pages_contains_the_complete_admin_app(self):
        for path in (
            ADMIN_APP_HTML,
            ADMIN_APP_JS,
            ADMIN_GITHUB_CLIENT,
            ADMIN_IMAGE_CROP,
            ADMIN_APP / "admin.css",
        ):
            with self.subTest(path=path):
                self.assertTrue(path.exists())

    def test_admin_no_longer_requires_a_cloudflare_worker(self):
        self.assertFalse((ROOT / "workers" / "admin" / "wrangler.jsonc").exists())
        self.assertFalse((ROOT / "workers" / "admin" / "src" / "index.ts").exists())

    def test_brand_icon_is_transparent_and_without_removed_canvas_path(self):
        content = ICON_SVG.read_text(encoding="utf-8")
        self.assertNotIn("#FEA4FC", content)
        self.assertNotIn(REMOVED_FULL_CANVAS_PATH, content)
        self.assertIn(FOREGROUND_SIGNATURE, content)
        self.assertEqual(content.count("<path "), APPROVED_PATH_COUNT)

    def test_admin_html_redirects_to_the_github_pages_admin_app(self):
        content = ADMIN_HTML.read_text(encoding="utf-8")
        self.assertIn("<title>Admin | AllenLin</title>", content)
        self.assertIn('content="0; url=admin/"', content)
        self.assertIn('http-equiv="refresh"', content)
        self.assertNotIn("workers.dev", content)
        self.assertNotIn("Personal Access Token", content)
        self.assertNotIn("unpkg.com", content)

    def test_admin_uses_an_explicit_browser_token_without_third_party_scripts(self):
        combined = "\n".join(
            path.read_text(encoding="utf-8")
            for path in (ADMIN_APP_HTML, ADMIN_APP_JS, ADMIN_GITHUB_CLIENT)
            if path.exists()
        )
        self.assertIn('id="token-input"', combined)
        self.assertIn('id="remember-device"', combined)
        self.assertIn("sessionStorage", combined)
        self.assertIn("localStorage", combined)
        self.assertIn("https://api.github.com", combined)
        self.assertIn("Authorization", combined)
        self.assertNotIn("unpkg.com", combined)
        self.assertIn("connect-src https://api.github.com", combined)
        self.assertIn('href="./admin.css"', combined)
        self.assertIn('src="./admin.js"', combined)

    def test_perfume_editor_has_the_complete_current_schema(self):
        html = ADMIN_APP_HTML.read_text(encoding="utf-8")
        script = ADMIN_APP_JS.read_text(encoding="utf-8")
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

    def test_admin_image_upload_opens_a_touch_friendly_manual_cropper(self):
        html = ADMIN_APP_HTML.read_text(encoding="utf-8")
        script = ADMIN_APP_JS.read_text(encoding="utf-8")
        for element_id in (
            "crop-dialog",
            "crop-canvas",
            "crop-zoom",
            "crop-cancel",
            "crop-apply",
        ):
            with self.subTest(element_id=element_id):
                self.assertIn(f'id="{element_id}"', html)
        self.assertIn("pointerdown", script)
        self.assertIn("setPointerCapture", script)
        self.assertIn("getCropPreset", script)
        self.assertIn("getCoverPlacement", script)

    def test_png_favicon_variants_are_published(self):
        for filename in ("favicon-32.png", "apple-touch-icon.png"):
            with self.subTest(filename=filename):
                self.assertTrue((PUBLIC / "assets" / "brand" / filename).exists())


if __name__ == "__main__":
    unittest.main()
