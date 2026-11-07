# Todo App ＆ 番茄鐘 — 生產力小工具 (Productivity Widget)

一款結合**待辦任務管理**、**番茄鐘專注計時（25分鐘工作／5分鐘休息）**與**即時統計儀表板**的現代化生產力小工具（Productivity Widget），採用純 HTML、CSS 與 JavaScript 打造，支援行動裝置小工具排版（Mobile Widget Style）與 PWA 離線使用。

## 功能特色

- 📊 **統計儀表板小工具（Dashboard Cards）**：
  - 即時顯示四張核心摘要卡片：**總任務**、**已完成**、**未完成**、**完成率 (%)** 與動態進度條。
- 🍅 **番茄鐘專注計時（Pomodoro Timer）**：
  - 內建 **25分鐘工作** 與 **5分鐘休息** 雙模式切換、SVG 圓環進度指示、開始／暫停／重置控制。
  - 完成 25 分鐘工作後自動發出提示音、累計已完成番茄數（`已完成 X 顆🍅`，自動保存於 `localStorage`），並無縫切換至 5 分鐘休息模式。
- 📅 **任務截止日期（Due Date）**：
  - 新增與編輯任務時可設定截止日期，顯示於任務下方。
  - **已逾期任務**使用紅色標示並顯示逾期天數；**今天到期任務**使用橘色標示。
- 🏷️ **優先級管理（Priority）**：
  - 支援 **高優先級（紅色）**、**中優先級（橘色）**、**低優先級（綠色）** 三種等級與左側色條指示。
  - 可依「建立時間」、「優先級（高→低）」或「截止日期」排序。
- ➕ **完整任務管理與搜尋篩選**：
  - 新增、行內編輯（點擊「編輯」或連點兩下文字）、刪除、勾選完成、一鍵清除已完成。
  - 支援即時關鍵字搜尋與「全部 / 未完成 / 已完成」狀態篩選。
- 📱 **行動小工具風格版面（Mobile Widget Style Layout）與深色模式**：
  - 採用 Bento 風格毛玻璃（Glassmorphism）小工具卡片設計，針對手機與桌面螢幕自動調整網格配置。
  - 支援 **深色模式（Dark Mode）**，自動偵測系統偏好並記住設定。
- 📲 **PWA 支援（Progressive Web App）**：
  - 內建 `manifest.json` 與 `service-worker.js`，支援「加到主畫面（Add to Home Screen）」獨立視窗運行與離線使用。

## 使用方式

### 1. 直接開啟或於本機啟動伺服器

可直接雙擊開啟 `index.html`，或於專案根目錄啟動本機靜態伺服器（建議以此方式體驗完整 PWA 與 Service Worker 離線快取）：

```bash
python -m http.server 8000
```

接著在瀏覽器開啟 `http://localhost:8000`。

### 2. 操作說明

1. **番茄鐘計時**：在「🍅 番茄鐘專注計時」卡片選擇 **25分鐘工作** 或 **5分鐘休息**，點擊「開始」啟動倒數，隨時可「暫停」或「重置」。
2. **新增任務**：輸入任務內容，選擇「截止日期」與「優先級（高／中／低）」，點擊「＋ 新增」或按 `Enter`。
3. **編輯任務**：點擊任務旁「編輯」（或對任務文字連點兩下），修改後按 `Enter` 或點「儲存」；按 `Esc` 取消。
4. **搜尋、篩選與排序**：使用搜尋欄過濾關鍵字、切換「全部 / 未完成 / 已完成」，或切換「依建立時間 / 依優先級 / 依截止日期」排序。

### 3. 執行自動化測試

```powershell
powershell -ExecutionPolicy Bypass -File tests\run-tests.ps1
```

## 專案截圖

### 桌面版生產力小工具（淺色 / 深色模式）

| 淺色模式 | 深色模式 |
| :---: | :---: |
| ![桌面版淺色模式](docs/screenshots/desktop-light.png) | ![桌面版深色模式](docs/screenshots/desktop-dark.png) |

### 行動裝置小工具版（淺色 / 深色模式）

| 淺色模式 | 深色模式 |
| :---: | :---: |
| ![手機版淺色模式](docs/screenshots/mobile-light.png) | ![手機版深色模式](docs/screenshots/mobile-dark.png) |

## 線上展示

- 🔗 **線上體驗（GitHub Pages）**：https://tim941008.github.io/todo-app/
- 📦 **專案原始碼（GitHub Repository）**：https://github.com/tim941008/todo-app

## 技術架構

- **前端核心**：純原生 HTML5、CSS3（CSS Custom Properties、Bento Grid、Flexbox、`backdrop-filter` 毛玻璃特效、SVG 圓環進度條）、Vanilla JavaScript（零外部相依套件、Web Audio API 提示音效）。
- **資料儲存**：瀏覽器 `localStorage`（儲存任務清單、主題偏好與累計完成番茄數，支援跨分頁 `storage` 事件同步）。
- **漸進式網路應用程式（PWA）**：
  - `manifest.json`：定義獨立視窗模式（`standalone`）、繁體中文描述與多尺寸圖示（192×192、512×512、Maskable 圖示）。
  - `service-worker.js`：預先快取 App Shell，同源請求採「網路優先、離線回退快取」策略。
- **自動化測試**：內建 135+ 項無頭瀏覽器測試（`tests/test.html` + `tests/run-tests.ps1`），完整驗證繁體中文介面、統計儀表板、番茄鐘倒數與模式切換、截止日期、優先級、深色模式、小工具響應式版面與 PWA。

## GitHub Pages

本專案透過 GitHub Pages 直接由 `main` 分支根目錄（`/`）自動部署：

1. 包含 `.nojekyll` 與相對路徑設定，確保於 `/todo-app/` 子路徑下所有圖示、Manifest 與 Service Worker 皆正常運作。
2. 推送至 `main` 分支後即自動發佈至 https://tim941008.github.io/todo-app/。
