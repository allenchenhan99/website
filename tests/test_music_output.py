from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"


class MusicOutputParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.cards = []
        self.spotify_sources = []
        self.iframes = []
        self.images = []
        self.picture_types = []

    @staticmethod
    def _classes(attributes):
        return attributes.get("class", "").split()

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        classes = self._classes(attributes)
        if tag == "article" and "grid-card" in classes:
            self.cards.append(attributes)
        if "spotify-embed" in classes:
            self.spotify_sources.append(attributes.get("data-src"))
        if tag == "iframe":
            self.iframes.append(attributes)
        if tag == "img":
            self.images.append(attributes)
        if tag == "source" and attributes.get("type"):
            self.picture_types.append(attributes["type"])


class MusicOutputTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.build = subprocess.run(
            ["npm", "run", "build"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        cls.html = (DIST / "music.html").read_text(encoding="utf-8")
        cls.parser = MusicOutputParser()
        cls.parser.feed(cls.html)

    def test_prerenders_every_music_post_without_runtime_json_fetch(self):
        expected = json.loads((ROOT / "posts" / "music.json").read_text(encoding="utf-8"))

        self.assertEqual(len(self.parser.cards), len(expected))
        for post in expected:
            self.assertIn(post["title"], self.html)
            self.assertIn(post["excerpt"], self.html)
        self.assertNotIn("posts/music.json", self.html)

    def test_defers_spotify_iframes_but_keeps_urls_in_data_attributes(self):
        self.assertEqual(self.parser.iframes, [])
        self.assertEqual(len(self.parser.spotify_sources), 2)
        self.assertTrue(all(url.startswith("https://open.spotify.com/embed/") for url in self.parser.spotify_sources))
        self.assertIn("min-height:352px", self.html.replace(" ", ""))

    def test_uses_optimized_fixed_images_and_real_lazy_cover_images(self):
        self.assertIn("image/avif", self.parser.picture_types)
        self.assertIn("image/webp", self.parser.picture_types)
        lazy_covers = [image for image in self.parser.images if "post-cover-image" in self._classes(image)]
        self.assertTrue(lazy_covers)
        self.assertTrue(all(image.get("loading") == "lazy" for image in lazy_covers))

    @staticmethod
    def _classes(attributes):
        return attributes.get("class", "").split()

    def test_public_output_does_not_load_vue(self):
        self.assertNotIn("unpkg.com/vue", self.html)
        self.assertNotIn("Vue.createApp", self.html)


if __name__ == "__main__":
    unittest.main()
