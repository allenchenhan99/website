# AllenLin Astro 效能架構設計

日期：2026-08-28  
狀態：已核准

## 背景

目前公開網站是由多個獨立 HTML 頁面、Vue 3 CDN 與頁面專用 JavaScript 組成。每個公開頁面都必須先下載並執行 Vue，部分內容還要在掛載後額外抓取 JSON 或文字檔，造成內容顯示的等待鏈。首頁的 ASCII 與 Chipi 動畫、Music 頁的兩個 Spotify iframe，以及未針對裝置最佳化的大圖，會進一步延長完整載入時間。

量測時觀察到的主要問題：

- 公開頁面使用 `https://unpkg.com/vue@3`，造成第三方且會阻塞顯示的依賴。
- 首頁必須在 Vue 掛載後再抓取文章 JSON、`asciiArt.txt` 與 `chipi.txt`。
- ASCII 使用 26 次連續的 100ms timeout 才完成呈現。
- Music 頁在受限網路下完整載入約需 6.8 秒，主要延遲來自 Spotify iframe 與大型 Hero 圖片。
- 頁面導覽、Theme 與內容呈現邏輯在各頁重複。

## 目標

- 公開頁面的主要內容直接存在於初始 HTML，不依賴 Vue 掛載或執行期資料抓取。
- 維持目前視覺、文字、動畫與既有 `.html` 網址。
- 使用 `AllenLin` 作為全站名稱，並套用使用者提供的透明 icon。
- 保留 Theme、CV 中英文、Modal、文章篩選、Grid/List 與 ASCII／Chipi 動畫。
- 保留現有管理後台及 JSON 格式，後台更新後自動重新建置網站。
- 改善手機、平板與桌機的圖片與外部內容載入方式。
- Fast 3G／4× CPU 條件下達到 LCP < 2.5 秒、CLS < 0.1，且沒有頁面水平滑動。

## 非目標

- 不重新設計網站視覺風格或文案。
- 不重寫管理後台的 GitHub API 編輯流程。
- 不新增伺服器、資料庫、帳號系統或遠端監控服務。
- 不在本次遷移中改變文章 JSON schema，除非為建置驗證補上型別定義。

## 評估方案

### A. Astro 靜態產生（採用）

在建置階段讀取 JSON 與文字內容，輸出完整靜態 HTML。公開頁面只傳送互動所需的少量原生 JavaScript；管理後台維持隔離的 Vue CDN 頁面。

優點：初始內容最快、共用元件清楚、容易維護、適合 GitHub Pages。  
缺點：需要建立 Node 建置流程與一次性的頁面遷移。

### B. 純 HTML 與原生 JavaScript

移除 Vue，手動把資料與共用版型維護在各個 HTML 頁面。

優點：執行模型簡單、沒有框架 runtime。  
缺點：共用版型與內容容易重複，後台 JSON 更新仍需要自行撰寫產生器。

### C. Vite 與 Vue 正式版

保留 Vue 元件模型，改為本地 production bundle。

優點：遷移量較小。  
缺點：若沒有額外 prerender，仍須等待 runtime 與資料載入；效能與部署複雜度的平衡不如 Astro。

## 決策

採用 Astro 靜態輸出，並使用檔案型輸出保留 `index.html`、`profile.html`、`cv.html`、`music.html` 與 `perfume.html`。公開頁面不載入 Vue。管理後台繼續使用既有實作，作為獨立 legacy 頁面。

## 系統架構

```text
管理後台
  └─ 更新 posts/*.json 與上傳圖片
       └─ commit 到 main
            └─ GitHub Actions
                 ├─ 安裝鎖定依賴
                 ├─ 驗證內容與執行測試
                 ├─ Astro 靜態建置
                 └─ 部署 dist 到 GitHub Pages

Astro build
  ├─ 讀取 site config
  ├─ 讀取 Music／Perfume JSON
  ├─ 讀取 ASCII／Chipi 文字
  ├─ 產生完整 HTML
  └─ 打包少量互動腳本與最佳化資產
```

## 元件設計

### 全站

- `site config`：集中管理 `AllenLin`、部署網址、icon 與頁面標題格式。
- `BaseLayout`：HTML metadata、favicon、共用樣式與 Theme 初始化。
- `Navigation`：保留目前連結與 active 狀態。
- `ThemeToggle`：使用原生 JavaScript 與 `localStorage`；在第一次繪製前套用主題，避免閃爍。

### 首頁

- Recent Posts 在建置時合併 Music 與 Perfume JSON、依日期排序並輸出前三筆。
- ASCII 文字在建置時載入，瀏覽器腳本只負責原本的分塊動畫，不再額外 fetch。
- Chipi 第一幀直接輸出到 HTML；完整動畫資料以低優先序載入，避免阻塞主要內容。
- Recent Modal 使用原生 dialog／DOM 行為，維持目前樣式與操作。

### Profile

- 內容完全靜態輸出。
- 固定 Hero 與頭像產生適合不同 viewport 的尺寸與格式，並帶有固定寬高以避免版面位移。

### CV

- 中英文內容都在建置時輸出。
- 語言按鈕以 `hidden`／data attribute 切換，偏好保存在 `localStorage`，不需 Vue runtime。

### Music

- Hero 圖片針對裝置產生多尺寸資產。
- Spotify card 保留原尺寸；iframe 的 URL 暫存在 `data-src`，接近可視區時透過 `IntersectionObserver` 建立。
- Posts 在建置時由 JSON 產生。
- Grid/List 與文章 Modal 由小型原生 JavaScript 控制。

### Perfume

- Posts 在建置時由 JSON 產生。
- 篩選、視圖切換與 Modal 使用原生 JavaScript，無需重新抓取內容。

### 管理後台

- 保留現有 Vue、CropperJS、GitHub API 與 JSON 格式。
- 後台提交到 `main` 後觸發部署 workflow。
- 後台 metadata 會同步顯示 `AllenLin` 與相同 favicon，但不列入公開頁面效能預算。

## 品牌與 Icon

- 全站名稱：`AllenLin`。
- 首頁 title：`AllenLin`。
- 內頁 title：`<Page> | AllenLin`。
- 來源 icon：`assets/brand/allenlin-icon.svg`，背景透明且已移除粉色外輪廓殘片。
- 由 SVG 衍生小尺寸 PNG favicon 與 Apple Touch Icon；SVG 保留為支援瀏覽器的主要 favicon。

## 資料流

- `posts/music.json` 與 `posts/perfume.json` 是唯一文章來源。
- Astro build 驗證必要欄位、日期格式、唯一 ID 與可選圖片路徑。
- 首頁與分類頁共用相同的已驗證資料，避免兩套排序或轉換邏輯。
- 固定網站資產由 Astro 管理與最佳化；後台上傳圖片維持穩定路徑，使用 lazy loading、固定尺寸與 placeholder。

## 錯誤處理

- JSON 無效、必要欄位缺失、ID 重複，或核心 ASCII／Chipi 檔案遺失時，建置失敗並保留上一個成功部署版本。
- 非必要文章圖片遺失時顯示既有 placeholder，不阻止整站部署。
- Spotify 載入失敗時保留 card，顯示可直接開啟 Spotify 的連結。
- `localStorage` 無法使用時，Theme 退回作業系統偏好，CV 語言退回英文。
- 不加入遠端錯誤監控；建置錯誤由 GitHub Actions log 提供。

## 部署

- GitHub Pages 的來源改為 GitHub Actions。
- Workflow 在 `main` push 與手動觸發時執行。
- 順序為 install、validation、test、build、deploy；只有前面全部通過才發布 `dist`。
- 使用 lockfile 固定依賴，並快取 package manager 資料。
- 同時只保留最新的部署工作，取消尚未完成的舊建置。

## 測試與驗收

### 自動測試

- 建置輸出包含全部既有 `.html` 路由。
- 導覽、資產與文章連結沒有 broken path。
- JSON schema、日期、ID 與首頁 recent 排序正確。
- 公開輸出不包含 Vue CDN。
- Title、SVG favicon、PNG favicon 與 Apple Touch Icon 正確。
- Theme、CV 語言、Grid/List、篩選、Modal 與 lazy Spotify 行為正常。
- 既有 CV 與 responsive contract 測試持續通過或等價遷移。

### 視覺與瀏覽器驗證

- 對首頁、Profile、CV、Music、Perfume 進行桌機、平板與手機截圖比較。
- 確認 ASCII 與 Chipi 的視覺、節奏及 responsive scaling。
- 確認所有 viewport 沒有文件層級水平捲動。

### 效能驗收

- 使用 Fast 3G 與 4× CPU throttling 重新量測首頁及 Music 頁。
- 公開頁面不再從 Unpkg 載入 Vue。
- LCP < 2.5 秒、CLS < 0.1。
- Music 初始載入不等待 Spotify iframe 完成。

## 遷移策略

1. 建立 Astro、TypeScript、測試與 GitHub Pages workflow 骨架。
2. 建立 config、BaseLayout、Navigation、Theme 與內容驗證層。
3. 逐頁遷移，先處理靜態頁，再處理互動較多的 Home、Music 與 Perfume。
4. 接入 AllenLin metadata、SVG 與衍生 favicon。
5. 執行功能、視覺、responsive 與效能驗證。
6. 部署 preview／artifact 驗證後，將 Pages 切換到 Actions 發布。

