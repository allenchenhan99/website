# CV Content Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both language modes of the website CV match the facts and section structure of the new `cv_pdf/English_CV.pdf`.

**Architecture:** Keep the existing static Vue 3 page and its inline English/Traditional Chinese ternaries. Update only the content structure in `cv.html`, add a dependency-free regression test for source-of-truth strings, and preserve the stable PDF filenames and existing CSS layout.

**Tech Stack:** HTML5, Vue 3 CDN Options API, CSS, Python 3 standard-library `unittest`, Poppler tools.

## Global Constraints

- Treat `cv_pdf/English_CV.pdf` as the factual source of truth.
- Keep `cv_pdf/Chinese_CV.pdf` unchanged.
- Preserve theme switching, language switching, navigation, and PDF downloads.
- Do not add JavaScript or CSS dependencies.
- Do not stage or commit `.DS_Store`.

---

### Task 1: Add CV content regression coverage

**Files:**
- Create: `tests/test_cv_content.py`
- Read: `cv.html`

**Interfaces:**
- Consumes: the rendered-source strings stored directly in `cv.html`.
- Produces: a standard-library test that defines required new facts, required Chinese translations, removed legacy facts, and stable link targets.

- [x] **Step 1: Write the failing test**

```python
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
        self.assertIn("https://allenchenhan99.github.io/website/", self.content)
        self.assertIn("https://www.linkedin.com/in/chen-han-lin-488492344/", self.content)
        self.assertEqual(self.content.count("./cv_pdf/English_CV.pdf"), 2)
        self.assertEqual(self.content.count("./cv_pdf/Chinese_CV.pdf"), 2)


if __name__ == "__main__":
    unittest.main()
```

- [x] **Step 2: Run the test to verify it fails**

Run: `python3 tests/test_cv_content.py -v`

Expected: failures for the new internship, WorldQuant, new skill groups, Chinese translations, and updated links; failures also show legacy entries are still present.

### Task 2: Synchronize the bilingual CV page

**Files:**
- Modify: `cv.html:25-262`
- Test: `tests/test_cv_content.py`

**Interfaces:**
- Consumes: facts and ordering from `cv_pdf/English_CV.pdf` plus its embedded link annotations.
- Produces: the existing Vue template with synchronized `lang === 'en' ? ... : ...` content.

- [x] **Step 1: Update header and education**

Use these exact header values and links:

```html
<p class="cv-subtitle">{{ lang === 'en' ? 'M.S. in Data Science and Engineering' : '數據科學與工程碩士' }}</p>
<a href="https://allenchenhan99.github.io/website/" target="_blank">Portfolio</a>
<a href="https://www.linkedin.com/in/chen-han-lin-488492344/" target="_blank">LinkedIn</a>
```

Set the master's period to `2023/09 – 2026/07`; preserve the bachelor's period. Include College of Computer Science / 資訊學院 and College of Science / 理學院 in their organization text.

- [x] **Step 2: Replace research and experience with source sections**

Rename Research to Master's Thesis / 碩士論文 and use the source title, advisor, and Mamba/VPT/CUDA description. Replace both legacy work items with one Internship Experience / 實習經歷 item:

```html
<h3>{{ lang === 'en' ? 'Data Scientist Intern' : '資料科學實習生' }}</h3>
<div class="org">Whale Force Holdings Ltd.</div>
```

Add separate bilingual paragraphs for Systematic Strategy Research / 系統化策略研究, Financial Data Infrastructure / 金融資料基礎建設, and Institutional Portfolio Research / 機構投資組合研究.

- [x] **Step 3: Synchronize projects and honors**

Keep exactly these projects in PDF order:

1. Low-Rank Adaptation and Combined Parameter-Efficient Tuning for Large Models
2. Data Science Project: Pima Indian Diabetes Dataset
3. Game Theory Applied to Darts Strategies

Keep exactly these honors and competitions in PDF order:

1. TSMC IT CareerHack — Feb 2026 — 1st Place
2. WorldQuant International Quant Championship — Mar 2026 – Jun 2026 — 4th Place in Taiwan
3. TSMC IT CareerHack — Jan 2024 — 4th Place
4. TSMC Intelligent Manufacturing Workshop — Mar 2025 — Top-Performing Team, Scheduling Optimization
5. AI CUP 2024 Image Data Generation for UAVs — May 2024 – Jun 2024 — Honorable Award
6. AI GO Skyrocketed Stocks Forecasting — Mar 2025 – Apr 2025

Use the PDF's metrics verbatim in English (`5,164`, `1,023`, `52-alpha`, `+3.6%`, `1.6%`, `0.945`, `83.6%`, `91.2%`, `84.5%`, `88.2%`, `86.3%`) and preserve them in the Chinese translations.

- [x] **Step 4: Replace skills and remove obsolete sections**

Create four bilingual skill groups:

```text
Programming, Data & Machine Learning / 程式設計、資料與機器學習
Quantitative Research / 量化研究
AI Engineering & Agentic Workflows / AI 工程與代理工作流程
Software Engineering & Infrastructure / 軟體工程與基礎設施
```

Populate each group with the tools and capabilities from the PDF. Remove the old Extracurricular section entirely.

- [x] **Step 5: Run the regression test**

Run: `python3 tests/test_cv_content.py -v`

Expected: `Ran 4 tests` and `OK`.

### Task 3: Validate structure and presentation

**Files:**
- Verify: `cv.html`
- Verify: `js/cv.js`
- Verify: `cv_pdf/English_CV.pdf`
- Verify: `cv_pdf/Chinese_CV.pdf`

**Interfaces:**
- Consumes: the completed static page.
- Produces: verification evidence for syntax, content, links, responsive layout, and both language modes.

- [x] **Step 1: Run static checks**

```bash
node --check js/cv.js
git diff --check
python3 tests/test_cv_content.py -v
pdfinfo cv_pdf/English_CV.pdf | rg '^(Pages|Encrypted):'
rg -n 'English_CV\.pdf|Chinese_CV\.pdf' cv.html
```

Expected: no syntax or whitespace errors, four passing tests, two-page unencrypted English PDF, and two references to each stable PDF filename.

- [x] **Step 2: Render and inspect the page**

Run a local static server, open `http://127.0.0.1:8000/cv.html`, then inspect English and Chinese modes at desktop and mobile widths. Confirm no clipped text, overlapping elements, broken hierarchy, or horizontal overflow.

- [x] **Step 3: Commit the implementation**

```bash
git add cv.html tests/test_cv_content.py docs/superpowers/plans/2026-07-20-cv-content-sync.md
git commit -m "Sync CV page with updated resume"
```

Expected: a commit containing only the implementation plan, CV page, and regression test; `.DS_Store` remains unstaged.
