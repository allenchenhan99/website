# CV Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refresh the bilingual public CV page from the supplied English PDF, publish that PDF as the English download, and preserve the existing Chinese PDF link.

**Architecture:** Keep the current static Astro CV page and language controller unchanged structurally. Treat the supplied English PDF as the source of truth, express its updated facts in both English and translated Chinese markup, and protect the result with source-level content contracts plus the existing browser suite.

**Tech Stack:** Astro 7, TypeScript, Python `unittest` contracts, Playwright, Poppler PDF inspection

---

### Task 1: Add failing contracts for the refreshed CV

**Files:**
- Modify: `tests/test_cv_content.py`
- Test: `tests/test_cv_content.py`

**Step 1: Write the failing content tests**

Update `test_contains_new_english_source_facts` so its required facts include:

```python
required = [
    "2026/03 – 2026/07",
    "10,000-path Monte Carlo random-pick null distributions",
    "rule-based XBRL tree traversal",
    "official SEC company-facts API",
    "44 quarters of raw SEC 13F filings",
    "silhouette, Calinski-Harabasz, and Davies-Bouldin indices",
    "LoRA and Combined Parameter-Efficient Tuning for Large Models",
    "2024/06",
    "2025/03 – 2025/06",
    "Owned the full pipeline from raw data to conclusions",
]
```

Update `test_contains_chinese_translations` with matching required phrases:

```python
required = [
    "2026/03 – 2026/07",
    "10,000 條路徑",
    "規則式 XBRL 樹狀結構遍歷",
    "SEC company-facts API",
    "44 季",
    "silhouette、Calinski-Harabasz 與 Davies-Bouldin",
    "大型模型之 LoRA 與組合式參數高效微調",
    "從原始資料到研究結論的完整流程",
]
```

Strengthen `test_removes_entries_absent_from_new_pdf`:

```python
removed = [
    "Game Theory Applied to Darts Strategies",
    "賽局理論於飛鏢策略優化之應用",
    "2026/03 – <span data-lang=\"en\">Present</span>",
    "Financial Data Infrastructure",
    "金融資料基礎建設",
]
```

Add PDF paths and an artifact contract:

```python
import hashlib

ENGLISH_PDF = ROOT / "public" / "cv_pdf" / "English_CV.pdf"
CHINESE_PDF = ROOT / "public" / "cv_pdf" / "Chinese_CV.pdf"
NEW_ENGLISH_PDF_SHA256 = (
    "300b9f75f48cf0affc6c8667f59d8bb2cc476267a539efb408d30169123c578c"
)

def test_publishes_new_english_pdf_and_preserves_chinese_pdf_link(self):
    digest = hashlib.sha256(ENGLISH_PDF.read_bytes()).hexdigest()
    self.assertEqual(digest, NEW_ENGLISH_PDF_SHA256)
    self.assertTrue(CHINESE_PDF.exists())
    self.assertIn('withBase("cv_pdf/English_CV.pdf")', self.content)
    self.assertIn('withBase("cv_pdf/Chinese_CV.pdf")', self.content)
```

**Step 2: Run the focused test to verify RED**

Run: `python3 -m unittest tests.test_cv_content -v`

Expected: FAIL because the page still contains the previous internship/project copy and `English_CV.pdf` has the old checksum.

**Step 3: Commit the failing tests**

```bash
git add tests/test_cv_content.py
git commit -m "test: specify refreshed CV content"
```

### Task 2: Replace the English PDF and refresh bilingual page content

**Files:**
- Modify: `public/cv_pdf/English_CV.pdf`
- Modify: `src/pages/cv.astro`
- Preserve: `public/cv_pdf/Chinese_CV.pdf`
- Test: `tests/test_cv_content.py`

**Step 1: Mark the PDF edit operation**

Immediately before copying the PDF, run once from the workspace runtime location required by `@pdf`:

```bash
node container_tools/mark_artifact_operation_started.mjs \
  --operation-kind edit \
  --expected-output-count 1 \
  --output-format pdf
```

Expected: command succeeds exactly once before the PDF replacement.

**Step 2: Publish the supplied English PDF**

Copy `/Users/allenchenhan99/Downloads/Lin_Chen_Han_CV_New.pdf` over `public/cv_pdf/English_CV.pdf`. Do not modify `public/cv_pdf/Chinese_CV.pdf`.

**Step 3: Update the internship block**

In `src/pages/cv.astro`:

- Replace the internship date with `2026/03 – 2026/07`.
- Keep the company and job title.
- Replace `Financial Data Infrastructure` with `Financial Statement Parsing`.
- Render three distinct bilingual result paragraphs that preserve the facts from the PDF:
  - 10,000-path Monte Carlo random-pick null distributions for excess return and Sharpe-ratio significance.
  - Rule-based XBRL tree traversal recovering items missed by the official SEC company-facts API and validation against OCR ground truth.
  - Clustering 44 quarters of SEC 13F filings using portfolio features and direct holdings-weight vectors, then validating with silhouette, Calinski-Harabasz, and Davies-Bouldin indices.

**Step 4: Update the projects block**

In `src/pages/cv.astro`:

- Rename the first project to `LoRA and Combined Parameter-Efficient Tuning for Large Models` and add `2024/06`.
- Preserve its three PEFT findings, including +3.6%, 1.6%, and RoBERTa 0.931 to 0.945.
- Add `2025/03 – 2025/06` to the Pima project.
- Start the Pima description with `Owned the full pipeline from raw data to conclusions` and preserve all reported metrics.
- Remove the full Game Theory Applied to Darts timeline item.
- Add matching, natural Traditional Chinese translations for every changed fact.

Do not change the page layout, CV styles, language script, navigation, or the two existing PDF URLs.

**Step 5: Run the focused test to verify GREEN**

Run: `python3 -m unittest tests.test_cv_content -v`

Expected: all CV content tests pass.

**Step 6: Verify the PDF artifact**

Run:

```bash
shasum -a 256 \
  /Users/allenchenhan99/Downloads/Lin_Chen_Han_CV_New.pdf \
  public/cv_pdf/English_CV.pdf
pdfinfo public/cv_pdf/English_CV.pdf
pdftoppm -png -r 144 public/cv_pdf/English_CV.pdf tmp/pdfs/cv-refresh/page
```

Expected: both SHA-256 values equal `300b9f...c578c`; PDF is unencrypted, two Letter pages, and rendered pages have no clipping, overlap, or illegible content.

**Step 7: Commit the implementation**

```bash
git add src/pages/cv.astro public/cv_pdf/English_CV.pdf
git commit -m "feat: refresh bilingual CV content"
```

### Task 3: Verify the complete site and responsive CV behavior

**Files:**
- Verify: `src/pages/cv.astro`
- Verify: `public/cv_pdf/English_CV.pdf`
- Verify: `public/cv_pdf/Chinese_CV.pdf`
- Verify: `tests/e2e/public-pages.spec.ts`

**Step 1: Run static and unit verification**

Run: `npm run check && npm test && npm run build`

Expected: Astro reports zero diagnostics, 40 Vitest tests pass, all Python contracts pass, and all five public pages build.

**Step 2: Run browser verification**

Run: `npm run test:e2e`

Expected: all Playwright journeys pass, including CV language switching and responsive containment.

**Step 3: Inspect the production CV page**

Start the production preview and inspect `/website/cv.html` at desktop and mobile widths. Confirm:

- English is the initial language.
- Toggling to Chinese reveals the updated translations.
- English PDF button resolves to the new two-page PDF.
- Chinese PDF button still resolves to the existing Chinese PDF.
- No text overlaps or causes horizontal scrolling.

**Step 4: Check the final diff and working tree**

Run:

```bash
git diff --check main...HEAD
git status --short --branch
git log --oneline main..HEAD
```

Expected: no whitespace errors; only the design, plan, tests, page, and English PDF are changed; worktree is clean after commits.
