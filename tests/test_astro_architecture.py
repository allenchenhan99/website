from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
ROUTES = ("index", "profile", "cv", "music", "perfume")
LEGACY_PUBLIC_FILES = (
    "index.html",
    "profile.html",
    "cv.html",
    "music.html",
    "perfume.html",
    "js/app.js",
    "js/profile.js",
    "js/cv.js",
    "js/music.js",
    "js/perfume.js",
)


class AstroArchitectureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(
            ["npm", "run", "build"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )

    def test_astro_toolchain_exists(self):
        self.assertTrue((ROOT / "package.json").exists())
        self.assertTrue((ROOT / "astro.config.mjs").exists())

    def test_public_routes_are_astro_pages(self):
        for route in ROUTES:
            with self.subTest(route=route):
                self.assertTrue((ROOT / "src" / "pages" / f"{route}.astro").exists())

    def test_build_uses_file_output_and_repository_base(self):
        config = (ROOT / "astro.config.mjs").read_text(encoding="utf-8")
        self.assertIn("format: 'file'", config)
        self.assertIn("base: '/website'", config)

    def test_obsolete_public_entry_points_and_runtime_scripts_are_removed(self):
        for relative_path in LEGACY_PUBLIC_FILES:
            with self.subTest(relative_path=relative_path):
                self.assertFalse((ROOT / relative_path).exists())

    def test_fresh_public_build_has_all_routes_without_vue_runtime(self):
        for route in ROUTES:
            output = DIST / f"{route}.html"
            with self.subTest(route=route):
                self.assertTrue(output.exists())
                html = output.read_text(encoding="utf-8")
                self.assertNotIn("unpkg.com/vue", html)
                self.assertNotIn("Vue.createApp", html)

    def test_legacy_admin_runtime_remains_explicitly_isolated(self):
        self.assertTrue((ROOT / "public" / "admin.html").exists())
        self.assertTrue((ROOT / "public" / "admin-preview.html").exists())
        self.assertTrue((ROOT / "public" / "post-preview.html").exists())
        self.assertTrue((ROOT / "public" / "js" / "admin.js").exists())


if __name__ == "__main__":
    unittest.main()
