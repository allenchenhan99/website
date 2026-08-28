from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
ROUTES = ("index", "profile", "cv", "music", "perfume")


class AstroArchitectureTest(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
