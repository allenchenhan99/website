from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
PERFUME_PAGE = ROOT / "src" / "pages" / "perfume.astro"


class PerfumeOutputParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.cards = []
        self.dialogs = []
        self.filter_tags = []
        self.empty_states = []
        self.main_elements = 0
        self.count_depth = 0
        self.count_text = []

    @staticmethod
    def _classes(attributes):
        return attributes.get("class", "").split()

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        classes = self._classes(attributes)
        if attributes.get("data-perfume-card") is not None:
            self.cards.append(attributes)
        if tag == "dialog" and attributes.get("data-perfume-dialog") is not None:
            self.dialogs.append(attributes)
        if tag == "button" and "filter-tag" in classes:
            self.filter_tags.append(attributes)
        if "empty-state" in classes:
            self.empty_states.append(attributes)
        if tag == "main":
            self.main_elements += 1
        if "count-label" in classes:
            self.count_depth += 1

    def handle_endtag(self, tag):
        if self.count_depth:
            self.count_depth -= 1

    def handle_data(self, data):
        if self.count_depth:
            self.count_text.append(data)


class PerfumeOutputTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.build = subprocess.run(
            ["npm", "run", "build"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        cls.html = (DIST / "perfume.html").read_text(encoding="utf-8")
        cls.parser = PerfumeOutputParser()
        cls.parser.feed(cls.html)

    def test_prerenders_current_collection_without_runtime_fetch_or_vue(self):
        expected = json.loads((ROOT / "posts" / "perfume.json").read_text(encoding="utf-8"))

        self.assertEqual(len(self.parser.cards), len(expected))
        self.assertNotIn("posts/perfume.json", self.html)
        self.assertNotIn("unpkg.com/vue", self.html)
        self.assertNotIn("Vue.createApp", self.html)

    def test_current_collection_has_one_starwalker_entry_and_hidden_empty_state(self):
        expected = json.loads((ROOT / "posts" / "perfume.json").read_text(encoding="utf-8"))

        self.assertEqual(len(expected), 1)
        self.assertEqual(expected[0]["brand"], "Montblanc")
        self.assertEqual(expected[0]["name"], "Starwalker")
        self.assertEqual(expected[0]["title"], "安靜得剛剛好。")
        self.assertEqual(len(expected[0]["content"]), 5)
        self.assertEqual("".join(self.parser.count_text).strip(), "1 fragrance")
        self.assertEqual(len(self.parser.empty_states), 1)
        self.assertIn("hidden", self.parser.empty_states[0])
        self.assertEqual(len(self.parser.filter_tags), 4)
        self.assertEqual(self.parser.filter_tags[0].get("data-filter-value"), "All")

    def test_uses_compact_cards_and_defers_the_article_to_the_dialog(self):
        self.assertIn('class="collection-grid"', self.html)
        self.assertIn('class="compact-card-visual product-stage"', self.html)
        self.assertIn('class="compact-card-copy"', self.html)
        self.assertIn('class="personal-title">安靜得剛剛好。</span>', self.html)
        self.assertNotIn('class="featured"', self.html)
        self.assertNotIn('class="featured-excerpt"', self.html)
        self.assertEqual(self.html.count('class="detail-text article-copy"'), 1)
        self.assertIn("這種時候，Starwalker 就剛剛好。", self.html)

    def test_matches_the_music_hero_and_uses_the_approved_gallery_description(self):
        page = PERFUME_PAGE.read_text(encoding="utf-8")
        css = (ROOT / "src" / "styles" / "perfume.css").read_text(encoding="utf-8")
        description = (
            "To me, perfume is part of an outfit, but more than that, it’s an invisible accessory. "
            "The way we smell can say something that the way we look sometimes can’t. "
            "It feels a little more personal, a little closer, and somehow leaves a stronger memory."
        )

        self.assertIn('import galleryImage from "../assets/images/perfume-gallery-glass.png";', page)
        self.assertTrue((ROOT / "src" / "assets" / "images" / "perfume-gallery-glass.png").exists())
        self.assertIn('class="perfume-hero"', self.html)
        self.assertIn('class="hero-collection-rail"', self.html)
        self.assertIn('class="hero-description"', self.html)
        self.assertIn(description, self.html)
        self.assertRegex(css, r"\.hero-description h1\s*\{[\s\S]*?font-size:\s*28px")
        self.assertRegex(css, r"\.hero-description p\s*\{[\s\S]*?line-height:\s*1\.8;[\s\S]*?font-size:\s*14px")

    def test_collection_is_a_four_column_glass_display_with_a_complete_bottle(self):
        css = (ROOT / "src" / "styles" / "perfume.css").read_text(encoding="utf-8")
        perfume_data = json.loads((ROOT / "posts" / "perfume.json").read_text(encoding="utf-8"))

        self.assertEqual(perfume_data[0]["cover"], "assets/images/perfume-starwalker.jpg")
        self.assertTrue((ROOT / "public" / "assets" / "images" / "perfume-starwalker.jpg").exists())
        self.assertRegex(css, r"\.collection-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,")
        self.assertRegex(css, r"\.compact-card\s*\{[\s\S]*?grid-template-rows:\s*210px\s+auto")
        self.assertRegex(css, r"\.compact-card-image\s*\{[\s\S]*?height:\s*190px;[\s\S]*?object-fit:\s*contain")

    def test_uses_one_labelled_native_detail_dialog(self):
        self.assertEqual(len(self.parser.dialogs), 1)
        self.assertEqual(self.parser.dialogs[0].get("aria-labelledby"), "perfume-detail-title")

    def test_detail_dialog_uses_the_approved_split_dossier(self):
        css = (ROOT / "src" / "styles" / "perfume.css").read_text(encoding="utf-8")
        expected = json.loads((ROOT / "posts" / "perfume.json").read_text(encoding="utf-8"))[0]

        self.assertIn("notes", expected)
        self.assertIn("ratings", expected)
        self.assertEqual(expected["notes"]["top"], ["Bamboo", "Bergamot", "Mandarin Orange"])
        self.assertEqual(expected["notes"]["middle"], ["White Musk", "Sandalwood", "Cedar"])
        self.assertEqual(expected["notes"]["base"], ["Ginger", "Fir Resin", "Nutmeg", "Amber"])
        self.assertEqual(sorted(expected["ratings"].keys()), [
            "complexity",
            "dailyWearability",
            "longevity",
            "presence",
            "sweetness",
            "warmth",
        ])
        self.assertIn('class="detail-overview-row"', self.html)
        self.assertIn('class="detail-reflection-row"', self.html)
        self.assertIn('data-dialog-notes="top"', self.html)
        self.assertIn('data-dialog-radar', self.html)
        self.assertIn('data-dialog-scores', self.html)
        self.assertNotIn("主觀評分 · 1–5 · step 0.5", self.html)
        self.assertRegex(
            css,
            r"\.detail-overview-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*42fr\)\s+minmax\(0,\s*58fr\)",
        )
        self.assertRegex(
            css,
            r"\.detail-reflection-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*58fr\)\s+minmax\(0,\s*42fr\)",
        )
        self.assertRegex(
            css,
            r"\.detail-modal\.starwalker-modal\s*\{[\s\S]*?max-width:\s*1040px",
        )
        self.assertRegex(
            css,
            r"@media screen and \(max-width:\s*760px\)[\s\S]*?\.detail-overview-row,[\s\S]*?\.detail-reflection-row\s*\{[\s\S]*?grid-template-columns:\s*1fr",
        )

    def test_source_binds_compact_card_covers_to_the_loading_policy(self):
        page = PERFUME_PAGE.read_text(encoding="utf-8")
        client_script = (ROOT / "src" / "scripts" / "perfume.ts").read_text(encoding="utf-8")
        self.assertIn(
            'import { getPerfumeCoverLoading, getPerfumeCoverPresentation, getPerfumeFilterOptions } from "../scripts/perfume";',
            page,
        )
        self.assertIn('loading={getPerfumeCoverLoading(index)}', page)
        self.assertIn("import type {", client_script)
        self.assertNotIn("import {\n  type PerfumePost", client_script)

    def test_uses_the_layout_main_landmark_without_nesting_another(self):
        self.assertEqual(self.parser.main_elements, 1)


if __name__ == "__main__":
    unittest.main()
