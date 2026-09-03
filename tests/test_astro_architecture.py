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
PAGES_ADMIN_FILES = (
    "index.html",
    "admin.css",
    "admin.js",
    "github-client.js",
    "image-crop.js",
)
GENERATED_TEXT_SUFFIXES = {".html", ".js", ".mjs"}


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

    def test_fresh_public_build_has_all_routes(self):
        for route in ROUTES:
            output = DIST / f"{route}.html"
            with self.subTest(route=route):
                self.assertTrue(output.exists())

    def test_generated_public_runtime_has_no_vue(self):
        generated_files = sorted(
            path
            for path in DIST.rglob("*")
            if path.is_file() and path.suffix in GENERATED_TEXT_SUFFIXES
        )
        bundled_javascript = {
            *DIST.glob("_astro/*.js"),
            *DIST.glob("_astro/*.mjs"),
        }
        self.assertTrue(bundled_javascript.issubset(set(generated_files)))

        violations = []
        for path in generated_files:
            content = path.read_text(encoding="utf-8")
            for marker in ("unpkg.com/vue", "Vue.createApp"):
                if marker in content:
                    violations.append(f"{relative_path}: {marker}")

        self.assertEqual(violations, [])

    def test_legacy_admin_is_only_a_redirect(self):
        for root in (ROOT / "public", DIST):
            admin = root / "admin.html"
            content = admin.read_text(encoding="utf-8")
            self.assertIn('http-equiv="refresh"', content)
            self.assertNotIn("Vue.createApp", content)
            self.assertNotIn("Personal Access Token", content)

    def test_admin_runtime_is_published_in_an_isolated_pages_directory(self):
        for root in (ROOT / "public" / "admin", DIST / "admin"):
            for relative_path in PAGES_ADMIN_FILES:
                with self.subTest(root=root, relative_path=relative_path):
                    self.assertTrue((root / relative_path).exists())


if __name__ == "__main__":
    unittest.main()
