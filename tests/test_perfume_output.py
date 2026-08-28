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

        self.assertEqual(len(self.parser.cards), len(expected) * 2)
        self.assertNotIn("posts/perfume.json", self.html)
        self.assertNotIn("unpkg.com/vue", self.html)
        self.assertNotIn("Vue.createApp", self.html)

    def test_current_empty_collection_has_correct_count_and_visible_empty_state(self):
        self.assertEqual("".join(self.parser.count_text).strip(), "0 fragrances")
        self.assertEqual(len(self.parser.empty_states), 1)
        self.assertNotIn("hidden", self.parser.empty_states[0])
        self.assertEqual(len(self.parser.filter_tags), 1)
        self.assertEqual(self.parser.filter_tags[0].get("data-filter-value"), "All")

    def test_uses_one_labelled_native_detail_dialog(self):
        self.assertEqual(len(self.parser.dialogs), 1)
        self.assertEqual(self.parser.dialogs[0].get("aria-labelledby"), "perfume-detail-title")

    def test_source_binds_featured_and_grid_covers_to_the_loading_policy(self):
        page = PERFUME_PAGE.read_text(encoding="utf-8")
        self.assertIn(
            'import { getPerfumeCoverLoading, getPerfumeFilterOptions } from "../scripts/perfume";',
            page,
        )
        self.assertIn('loading={getPerfumeCoverLoading("featured", index)}', page)
        self.assertIn('loading={getPerfumeCoverLoading("grid", index)}', page)

    def test_uses_the_layout_main_landmark_without_nesting_another(self):
        self.assertEqual(self.parser.main_elements, 1)


if __name__ == "__main__":
    unittest.main()
