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

    def test_does_not_load_a_third_party_analytics_tracker(self):
        self.assertEqual(len(self.pages), 5)
        for name, html in self.pages.items():
            with self.subTest(page=name):
                self.assertNotIn("cloud.umami.is", html)
                self.assertNotIn("data-website-id", html)

    def test_exposes_only_the_public_stats_endpoint_to_home(self):
        home = self.pages["index.html"]
        self.assertIn('data-reach-stats-url="https://reach.example.workers.dev/"', home)
        self.assertNotIn("UMAMI_API_KEY", "\n".join(self.pages.values()))

    def test_source_configuration_only_requires_the_public_counter_url(self):
        source_paths = [
            ROOT / "src" / "layouts" / "BaseLayout.astro",
            ROOT / "src" / "env.d.ts",
            ROOT / ".env.example",
            ROOT / ".github" / "workflows" / "deploy.yml",
        ]
        source = "\n".join(path.read_text(encoding="utf-8") for path in source_paths)

        self.assertIn("PUBLIC_REACH_STATS_URL", source)
        self.assertNotIn("PUBLIC_UMAMI", source)
        self.assertNotIn("UMAMI_API", source)
        self.assertFalse((ROOT / "workers" / "reach-stats" / ".dev.vars.example").exists())


if __name__ == "__main__":
    unittest.main()
