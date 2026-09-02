import os
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"


class AnalyticsOutputTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        environment = os.environ.copy()
        environment.update(
            {
                "PUBLIC_UMAMI_SCRIPT_URL": "https://analytics.example/script.js",
                "PUBLIC_UMAMI_WEBSITE_ID": "00000000-0000-4000-8000-000000000001",
                "PUBLIC_REACH_STATS_URL": "https://reach.example.workers.dev/",
            }
        )
        subprocess.run(
            ["npm", "run", "build"],
            cwd=ROOT,
            env=environment,
            check=True,
            capture_output=True,
            text=True,
        )
        cls.pages = {
            path.name: path.read_text(encoding="utf-8")
            for path in DIST.glob("*.html")
            if path.name in {"index.html", "cv.html", "music.html", "perfume.html", "profile.html"}
        }

    def test_loads_umami_on_every_public_page_and_excludes_localhost(self):
        self.assertEqual(len(self.pages), 5)
        for name, html in self.pages.items():
            with self.subTest(page=name):
                self.assertIn('src="https://analytics.example/script.js"', html)
                self.assertIn('data-website-id="00000000-0000-4000-8000-000000000001"', html)
                self.assertIn('data-domains="allenchenhan99.github.io"', html)

    def test_exposes_only_the_public_stats_endpoint_to_home(self):
        home = self.pages["index.html"]
        self.assertIn('data-reach-stats-url="https://reach.example.workers.dev/"', home)
        self.assertNotIn("UMAMI_API_KEY", "\n".join(self.pages.values()))


if __name__ == "__main__":
    unittest.main()
