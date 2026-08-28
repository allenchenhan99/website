from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"


class HomeOutputParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.recent = []
        self.categories = []
        self.ascii_target = []
        self.ascii_source = []
        self.chipi_frame = []
        self.chipi_src = None

    @staticmethod
    def _classes(attributes):
        return attributes.get("class", "").split()

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        self.stack.append((tag, attributes))
        classes = self._classes(attributes)
        if tag == "button" and "recent-item" in classes:
            self.recent.append(
                {
                    "category": [],
                    "date": [],
                    "title": [],
                    "excerpt": [],
                    "href": attributes.get("data-detail-href"),
                }
            )
        if tag == "a" and "category-item" in classes:
            self.categories.append({"text": [], "href": attributes.get("href")})
        if tag == "pre" and attributes.get("id") == "chipi-animation":
            self.chipi_src = attributes.get("data-chipi-src")

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                return

    def handle_data(self, data):
        ancestors = list(reversed(self.stack))
        recent_item = next(
            (
                attributes
                for tag, attributes in ancestors
                if tag == "button" and "recent-item" in self._classes(attributes)
            ),
            None,
        )
        if recent_item is not None and self.recent:
            classes = {
                class_name
                for _, attributes in ancestors
                for class_name in self._classes(attributes)
            }
            for field in ("category", "date", "title", "excerpt"):
                if f"recent-{field if field != 'category' else 'tag'}" in classes:
                    self.recent[-1][field].append(data)

        category_item = next(
            (
                attributes
                for tag, attributes in ancestors
                if tag == "a" and "category-item" in self._classes(attributes)
            ),
            None,
        )
        if category_item is not None and self.categories:
            self.categories[-1]["text"].append(data)

        for tag, attributes in ancestors:
            if tag == "pre" and attributes.get("id") == "ascii-art":
                self.ascii_target.append(data)
                break
            if tag == "template" and "data-ascii-source" in attributes:
                self.ascii_source.append(data)
                break
            if tag == "pre" and attributes.get("id") == "chipi-animation":
                self.chipi_frame.append(data)
                break


class HomeOutputTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.build = subprocess.run(
            ["npm", "run", "build"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        cls.html = (DIST / "index.html").read_text(encoding="utf-8")
        cls.parser = HomeOutputParser()
        cls.parser.feed(cls.html)

    def test_prerenders_three_recent_entries_in_source_date_order(self):
        music = json.loads((ROOT / "posts" / "music.json").read_text(encoding="utf-8"))
        perfume = json.loads((ROOT / "posts" / "perfume.json").read_text(encoding="utf-8"))
        expected = [
            *[
                {
                    "category": "music",
                    "date": post["date"],
                    "title": post["title"],
                    "excerpt": post["excerpt"],
                    "href": "music.html",
                }
                for post in music
            ],
            *[
                {
                    "category": "perfume",
                    "date": post["date"],
                    "title": f'{post["brand"]} — {post["name"]}',
                    "excerpt": post["excerpt"],
                    "href": "perfume.html",
                }
                for post in perfume
            ],
        ]
        expected = sorted(expected, key=lambda post: post["date"], reverse=True)[:3]
        actual = [
            {
                key: "".join(value) if isinstance(value, list) else value
                for key, value in recent.items()
            }
            for recent in self.parser.recent
        ]

        self.assertEqual(actual, expected)

    def test_prerenders_all_category_links(self):
        actual = [
            (category["href"], "".join(category["text"]))
            for category in self.parser.categories
        ]
        self.assertEqual(
            actual,
            [
                ("profile.html", "ProfileAbout me and my journey"),
                ("cv.html", "CVCurriculum Vitae"),
                ("music.html", "MusicAlbums, songs & reflections"),
                ("perfume.html", "PerfumeFragrance journey & reviews"),
            ],
        )

    def test_embeds_exact_ascii_source_but_leaves_target_empty(self):
        ascii_source = (ROOT / "asciiArt.txt").read_text(encoding="utf-8")

        self.assertEqual("".join(self.parser.ascii_target), "")
        self.assertEqual("".join(self.parser.ascii_source).rstrip(), ascii_source.rstrip())

    def test_prerenders_only_the_exact_first_chipi_frame(self):
        chipi_source = (ROOT / "chipi.txt").read_text(encoding="utf-8")
        expected_frame = "\n".join(chipi_source.rstrip().split("\n")[:42])
        rendered_frame = "".join(self.parser.chipi_frame)

        self.assertEqual(rendered_frame, expected_frame)
        self.assertEqual(len(rendered_frame.split("\n")), 42)
        self.assertNotIn(chipi_source, self.html)

        emitted_path = DIST / self.parser.chipi_src.removeprefix("/website/")
        self.assertEqual(emitted_path.read_text(encoding="utf-8"), chipi_source)

    def test_emitted_client_code_has_no_vue_or_article_ascii_fetches(self):
        client_code = self.html + "\n".join(
            path.read_text(encoding="utf-8")
            for path in (DIST / "_astro").glob("*.js")
        )
        for forbidden in (
            "unpkg.com/vue",
            "Vue.createApp",
            "posts/music.json",
            "posts/perfume.json",
            "asciiArt.txt",
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, client_code)

        self.assertEqual(len(re.findall(r"\bfetch\(", client_code)), 1)
        self.assertRegex(client_code, r"priority\s*:\s*[`'\"]low[`'\"]")


if __name__ == "__main__":
    unittest.main()
