from pathlib import Path
import unittest


CV_HTML = Path(__file__).resolve().parents[1] / "cv.html"


class CvContentTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.content = CV_HTML.read_text(encoding="utf-8")

    def test_contains_new_english_source_facts(self):
        required = [
            "M.S. in Data Science and Engineering",
            "2023/09 – 2026/07",
            "Whale Force Holdings Ltd.",
            "Data Scientist Intern",
            "Systematic Strategy Research",
            "Financial Data Infrastructure",
            "Institutional Portfolio Research",
            "WorldQuant International Quant Championship",
            "4th Place in Taiwan",
            "5,164 alpha expressions",
            "AI Engineering & Agentic Workflows",
            "Software Engineering & Infrastructure",
        ]
        for text in required:
            with self.subTest(text=text):
                self.assertIn(text, self.content)

    def test_contains_chinese_translations(self):
        required = [
            "數據科學與工程碩士",
            "實習經歷",
            "資料科學實習生",
            "系統化策略研究",
            "金融資料基礎建設",
            "機構投資組合研究",
            "台灣第四名",
            "量化研究",
            "AI 工程與代理工作流程",
            "軟體工程與基礎設施",
        ]
        for text in required:
            with self.subTest(text=text):
                self.assertIn(text, self.content)

    def test_removes_entries_absent_from_new_pdf(self):
        removed = [
            "Research Assistant",
            "High School Math Tutor",
            "Simulating Oceanic Environments with OpenGL",
            "Housing Price Prediction",
            "Darts Club",
        ]
        for text in removed:
            with self.subTest(text=text):
                self.assertNotIn(text, self.content)

    def test_keeps_cv_links_current(self):
        self.assertIn("+886 978 261 955", self.content)
        self.assertIn("https://allenchenhan99.github.io/website/", self.content)
        self.assertIn(
            "https://www.linkedin.com/in/chen-han-lin-488492344/",
            self.content,
        )
        self.assertEqual(self.content.count("./cv_pdf/English_CV.pdf"), 1)
        self.assertEqual(self.content.count("./cv_pdf/Chinese_CV.pdf"), 1)
        self.assertNotIn("'Download PDF'", self.content)


if __name__ == "__main__":
    unittest.main()
