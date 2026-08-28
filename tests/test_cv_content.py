import hashlib
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CV_HTML = ROOT / "src" / "pages" / "cv.astro"
CV_LANGUAGE = ROOT / "src" / "scripts" / "cv-language.ts"
BASE_LAYOUT = ROOT / "src" / "layouts" / "BaseLayout.astro"
ENGLISH_PDF = ROOT / "public" / "cv_pdf" / "English_CV.pdf"
CHINESE_PDF = ROOT / "public" / "cv_pdf" / "Chinese_CV.pdf"
NEW_ENGLISH_PDF_SHA256 = "300b9f75f48cf0affc6c8667f59d8bb2cc476267a539efb408d30169123c578c"
OLD_CHINESE_PDF_SHA256 = "1e48066f89ab58f85bf092aa4cf331738e5f566f07f35cb7394f7cc6b61b6891"


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
            "2026/03 – 2026/07",
            "Systematic Strategy Research",
            "Institutional Portfolio Research",
            "10,000-path Monte Carlo random-pick null distributions",
            "rule-based XBRL tree traversal",
            "official SEC company-facts API",
            "44 quarters of raw SEC 13F filings",
            "silhouette, Calinski-Harabasz, and Davies-Bouldin indices",
            "LoRA and Combined Parameter-Efficient Tuning for Large Models",
            "2025/03 – 2025/06",
            "Owned the full pipeline from raw data to conclusions",
            "calibration curves",
            "WorldQuant International Quant Championship",
            "4th Place in Taiwan",
            "5,164 alpha expressions",
            "AI Engineering & Agentic Workflows",
            "Software Engineering & Infrastructure",
        ]
        for text in required:
            with self.subTest(text=text):
                self.assertIn(text, self.content)

        for topic in (
            "Systematic Strategy Research",
            "Financial Statement Parsing",
            "Institutional Portfolio Research",
        ):
            with self.subTest(internship_topic=topic):
                self.assertIn(
                    f'<p data-lang="en"><strong>{topic}:</strong>',
                    self.content,
                )

        lora_timeline_item = re.compile(
            r'<div class="timeline-item">\s*'
            r'<div class="timeline-dot"></div>\s*'
            r'<div class="timeline-date">2024/06</div>\s*'
            r'<div class="timeline-content">\s*'
            r'<h3><span data-lang="en">'
            r'LoRA and Combined Parameter-Efficient Tuning for Large Models'
            r'</span>',
        )
        self.assertRegex(self.content, lora_timeline_item)

    def test_contains_chinese_translations(self):
        required = [
            "數據科學與工程碩士",
            "實習經歷",
            "資料科學實習生",
            "2026/03 – 2026/07",
            "系統化策略研究",
            "機構投資組合研究",
            "10,000 條路徑",
            "規則式 XBRL 樹狀結構遍歷",
            "44 季",
            "silhouette、Calinski-Harabasz 與 Davies-Bouldin",
            "大型模型之 LoRA 與組合式參數高效微調",
            "從原始資料到研究結論的完整流程",
            "校準曲線",
            "台灣第四名",
            "量化研究",
            "AI 工程與代理工作流程",
            "軟體工程與基礎設施",
        ]
        for text in required:
            with self.subTest(text=text):
                self.assertIn(text, self.content)

        for topic in (
            "系統化策略研究",
            "財務報表解析",
            "機構投資組合研究",
        ):
            with self.subTest(internship_topic=topic):
                self.assertIn(
                    f'<p data-lang="zh" hidden><strong>{topic}：</strong>',
                    self.content,
                )

        chinese_xbrl_api_fact = re.compile(
            r'<p data-lang="zh" hidden>'
            r'(?:(?!</p>).)*規則式 XBRL 樹狀結構遍歷'
            r'(?:(?!</p>).)*官方 SEC company-facts API'
            r'(?:(?!</p>).)*</p>',
            re.DOTALL,
        )
        self.assertRegex(self.content, chinese_xbrl_api_fact)

    def test_removes_entries_absent_from_new_pdf(self):
        removed = [
            "Research Assistant",
            "High School Math Tutor",
            "Simulating Oceanic Environments with OpenGL",
            "Housing Price Prediction",
            "Darts Club",
            "Game Theory Applied to Darts Strategies",
            "賽局理論於飛鏢策略優化之應用",
            '2026/03 – <span data-lang="en">Present</span>',
            "Financial Data Infrastructure",
            "金融資料基礎建設",
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

    def test_publishes_new_english_pdf_and_preserves_chinese_pdf_link(self):
        english_pdf_sha256 = hashlib.sha256(ENGLISH_PDF.read_bytes()).hexdigest()
        chinese_pdf_sha256 = hashlib.sha256(CHINESE_PDF.read_bytes()).hexdigest()

        self.assertTrue(CHINESE_PDF.exists())
        self.assertEqual(chinese_pdf_sha256, OLD_CHINESE_PDF_SHA256)
        self.assertEqual(english_pdf_sha256, NEW_ENGLISH_PDF_SHA256)
        self.assertIn('withBase("cv_pdf/English_CV.pdf")', self.content)
        self.assertIn('withBase("cv_pdf/Chinese_CV.pdf")', self.content)

    def test_uses_static_bilingual_markup_without_vue_interpolation(self):
        self.assertIn('data-lang="en"', self.content)
        self.assertIn('data-lang="zh"', self.content)
        self.assertNotIn("{{", self.content)
        self.assertNotIn("lang ===", self.content)

    def test_declares_english_for_the_initial_cv_fallback(self):
        layout = BASE_LAYOUT.read_text(encoding="utf-8")
        self.assertIn("documentLanguage?: string;", layout)
        self.assertIn('documentLanguage = "zh-Hant"', layout)
        self.assertIn("<html lang={documentLanguage}>", layout)
        self.assertIn('documentLanguage="en"', self.content)

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
