from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ADMIN_HTML = PUBLIC / "admin.html"
ADMIN_JS = PUBLIC / "js" / "admin.js"
ICON_SVG = PUBLIC / "assets" / "brand" / "allenlin-icon.svg"
REMOVED_FULL_CANVAS_PATH = "M0 0 C211.2 0 422.4"
FOREGROUND_SIGNATURE = "M0 0 C0.67885254 0.4851709"
APPROVED_PATH_COUNT = 140


class PublicAssetsTest(unittest.TestCase):
    def test_admin_assets_are_published(self):
        for path in (
            ADMIN_HTML,
            ADMIN_JS,
            PUBLIC / "css" / "admin.css",
        ):
            with self.subTest(path=path):
                self.assertTrue(path.exists())

    def test_brand_icon_is_transparent_and_without_removed_canvas_path(self):
        content = ICON_SVG.read_text(encoding="utf-8")
        self.assertNotIn("#FEA4FC", content)
        self.assertNotIn(REMOVED_FULL_CANVAS_PATH, content)
        self.assertIn(FOREGROUND_SIGNATURE, content)
        self.assertEqual(content.count("<path "), APPROVED_PATH_COUNT)

    def test_admin_uses_shared_allenlin_favicon(self):
        content = ADMIN_HTML.read_text(encoding="utf-8")
        self.assertIn("<title>Admin | AllenLin</title>", content)
        self.assertIn('rel="icon"', content)
        self.assertIn('href="assets/brand/allenlin-icon.svg"', content)

    def test_uploaded_files_use_repository_path_but_store_public_url(self):
        content = ADMIN_JS.read_text(encoding="utf-8")
        self.assertIn(
            "const UPLOAD_REPO_DIR = 'public/assets/images/uploads';", content
        )
        self.assertIn(
            "const UPLOAD_PUBLIC_DIR = 'assets/images/uploads';", content
        )
        self.assertIn("`${UPLOAD_REPO_DIR}/${baseName}.${ext}`", content)
        self.assertIn(
            "finalPath.replace(`${UPLOAD_REPO_DIR}/`, `${UPLOAD_PUBLIC_DIR}/`)",
            content,
        )
        self.assertIn("this.musicForm.cover = publicPath;", content)
        self.assertIn("this.perfumeForm.cover = publicPath;", content)

    def test_png_favicon_variants_are_published(self):
        for filename in ("favicon-32.png", "apple-touch-icon.png"):
            with self.subTest(filename=filename):
                self.assertTrue((PUBLIC / "assets" / "brand" / filename).exists())


if __name__ == "__main__":
    unittest.main()
