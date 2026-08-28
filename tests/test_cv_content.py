from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
CV_HTML = ROOT / "src" / "pages" / "cv.astro"
CV_LANGUAGE = ROOT / "src" / "scripts" / "cv-language.ts"


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
        self.assertEqual(self.content.count("cv_pdf/English_CV.pdf"), 1)
        self.assertEqual(self.content.count("cv_pdf/Chinese_CV.pdf"), 1)
        self.assertIn('withBase("cv_pdf/English_CV.pdf")', self.content)
        self.assertIn('withBase("cv_pdf/Chinese_CV.pdf")', self.content)
        self.assertNotIn("'Download PDF'", self.content)

    def test_uses_static_bilingual_markup_without_vue_interpolation(self):
        self.assertIn('data-lang="en"', self.content)
        self.assertIn('data-lang="zh"', self.content)
        self.assertNotIn("{{", self.content)
        self.assertNotIn("lang ===", self.content)

    def test_language_controller_is_storage_safe_and_updates_document_language(self):
        self.assertTrue(CV_LANGUAGE.exists(), "CV language controller must exist")
        script = CV_LANGUAGE.read_text(encoding="utf-8")
        self.assertIn("cv-lang", script)
        self.assertIn("localStorage.getItem", script)
        self.assertIn("localStorage.setItem", script)
        self.assertIn('querySelectorAll<HTMLElement>("[data-lang]")', script)
        self.assertIn("document.documentElement.lang", script)
        self.assertIn('?? "en"', script)
        self.assertIn("try {", script)
        self.assertIn("catch", script)


if __name__ == "__main__":
    unittest.main()
