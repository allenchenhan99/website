from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
class MusicOutputParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.cards = []
        self.spotify_links = []
        self.hero_playlists = []
        self.legacy_playlist_sections = []
        self.iframes = []
        self.images = []
        self.picture_types = []
        self.vinyl_records = []
        self.vinyl_materials = []

    @staticmethod
    def _classes(attributes):
        return attributes.get("class", "").split()

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        classes = self._classes(attributes)
        if tag == "article" and "grid-card" in classes:
            self.cards.append(attributes)
        if tag == "a" and "hero-playlist-link" in classes:
            self.spotify_links.append(attributes)
        if "hero-playlists" in classes:
            self.hero_playlists.append(attributes)
        if "playlists-section" in classes:
            self.legacy_playlist_sections.append(attributes)
        if tag == "iframe":
            self.iframes.append(attributes)
        if tag == "img":
            self.images.append(attributes)
        if tag == "source" and attributes.get("type"):
            self.picture_types.append(attributes["type"])
        if "vinyl-record" in classes:
            self.vinyl_records.append(attributes)
        if "vinyl-material" in classes:
            self.vinyl_materials.append(attributes)


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

    def test_moves_compact_playlist_links_into_the_hero_and_removes_large_embeds(self):
        self.assertEqual(self.parser.iframes, [])
        self.assertEqual(len(self.parser.hero_playlists), 1)
        self.assertEqual(self.parser.legacy_playlist_sections, [])
        self.assertEqual(len(self.parser.spotify_links), 2)
        for link in self.parser.spotify_links:
            self.assertTrue(link.get("href", "").startswith("https://open.spotify.com/playlist/"))
            self.assertNotIn("/embed/", link["href"])
            self.assertEqual(link.get("target"), "_blank")
            self.assertEqual(link.get("rel"), "noreferrer")

        css = (ROOT / "src" / "styles" / "music.css").read_text(encoding="utf-8")
        hero_playlist_rule = re.search(r"\.hero-playlists\s*\{(?P<body>.*?)\}", css, re.DOTALL)
        self.assertIsNotNone(hero_playlist_rule)
        self.assertRegex(hero_playlist_rule.group("body"), r"position:\s*absolute")
        self.assertNotIn(".spotify-frame-slot", css)

    def test_playlist_rail_uses_real_covers_and_keeps_a_desktop_gap_from_the_description(self):
        page = (ROOT / "src" / "pages" / "music.astro").read_text(encoding="utf-8")
        css = (ROOT / "src" / "styles" / "music.css").read_text(encoding="utf-8")
        playlist_covers = [
            image for image in self.parser.images
            if "hero-playlist-cover" in self._classes(image)
        ]

        self.assertEqual(len(playlist_covers), 2)
        self.assertIn('import westernHipHopCover from "../assets/images/spotify-western-hiphop.jpg";', page)
        self.assertIn('import koreanHipHopCover from "../assets/images/spotify-korean-hiphop.jpg";', page)
        self.assertTrue((ROOT / "src" / "assets" / "images" / "spotify-western-hiphop.jpg").exists())
        self.assertTrue((ROOT / "src" / "assets" / "images" / "spotify-korean-hiphop.jpg").exists())
        self.assertRegex(css, r"\.hero-playlists\s*\{[\s\S]*?width:\s*290px")
        self.assertRegex(css, r"\.hero-playlist-link\s*\{[\s\S]*?grid-template-columns:\s*48px")
        self.assertRegex(css, r"\.text-container\s*\{[\s\S]*?width:\s*min\(900px,\s*calc\(90%\s*-\s*330px\)\)")

    def test_uses_optimized_fixed_images_and_real_lazy_cover_images(self):
        self.assertIn("image/avif", self.parser.picture_types)
        self.assertIn("image/webp", self.parser.picture_types)
        lazy_covers = [image for image in self.parser.images if "post-cover-image" in self._classes(image)]
        self.assertTrue(lazy_covers)
        self.assertTrue(all(image.get("loading") == "lazy" for image in lazy_covers))

    def test_restores_the_nujabes_background_and_replaces_the_blue_vinyl_area_with_the_cover(self):
        page = (ROOT / "src" / "pages" / "music.astro").read_text(encoding="utf-8")
        css = (ROOT / "src" / "styles" / "music.css").read_text(encoding="utf-8")

        self.assertIn('import heroImage from "../assets/images/pxfuel.jpg";', page)
        self.assertIn('import vinylImage from "../assets/images/vinyl-record-ochre.png";', page)
        self.assertNotIn("record-player.jpg", page)
        self.assertNotIn("jazz-midnight-ink.png", page)
        self.assertTrue((ROOT / "src" / "assets" / "images" / "vinyl-record-ochre.png").exists())
        self.assertEqual(len(self.parser.vinyl_records), 1)
        self.assertEqual(self.parser.vinyl_records[0].get("data-vinyl"), "album-art")
        self.assertEqual(len(self.parser.vinyl_materials), 1)
        vinyl_artwork_images = [image for image in self.parser.images if "vinyl-artwork" in self._classes(image)]
        vinyl_label_images = [image for image in self.parser.images if "vinyl-label-cover" in self._classes(image)]
        self.assertEqual(len(vinyl_artwork_images), 1)
        self.assertEqual(vinyl_label_images, [])
        self.assertIn("Rotating vinyl record filled with Nujabes Metaphorical Music cover art", self.html)
        self.assertIn('The image above showcases an album cover reminiscent of the "Metaphorical" style', self.html)
        self.assertIn('.vinyl-record', css)
        self.assertIn('.vinyl-artwork', css)
        self.assertNotIn('.vinyl-label-cover', css)
        self.assertNotIn('[data-vinyl="indigo"]', css)
        self.assertRegex(css, r"@keyframes\s+vinyl-spin")
        self.assertRegex(css, r"prefers-reduced-motion:\s*reduce[\s\S]*\.vinyl-record")

    @staticmethod
    def _classes(attributes):
        return attributes.get("class", "").split()

    def test_public_output_does_not_load_vue(self):
        self.assertNotIn("unpkg.com/vue", self.html)
        self.assertNotIn("Vue.createApp", self.html)

    def test_native_dialog_uses_only_the_backdrop_as_the_dark_overlay(self):
        css = (ROOT / "src" / "styles" / "music.css").read_text(encoding="utf-8")
        dialog_rule = re.search(r"\.detail-overlay\s*\{(?P<body>.*?)\}", css, re.DOTALL)
        backdrop_rule = re.search(r"\.detail-overlay::backdrop\s*\{(?P<body>.*?)\}", css, re.DOTALL)

        self.assertIsNotNone(dialog_rule)
        self.assertIsNotNone(backdrop_rule)
        self.assertIn("background: transparent", dialog_rule.group("body"))
        self.assertRegex(backdrop_rule.group("body"), r"background:\s*rgba\(0,\s*0,\s*0,\s*0\.4\)")


if __name__ == "__main__":
    unittest.main()
