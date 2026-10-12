# 專案交接與換機維運手冊 (Project Handover & Operations Guide)

本手冊供後續維護、換機接手或 AI Agent 快速銜接專案。記錄了從原始各分頁試算表演進至標準化 WebApp 的核心決策、最新開發進度與異地開發指引。

---

## 📌 一、 專案核心決策紀錄 (Decision Records)

1. **表格結構大改造（矩陣橫向表 → 關聯式流水帳）**：
   - 原表格每列橫向擴展 30 天～150 欄，導致維護困難且手機極易誤觸。
   - 轉為「範本字典 (`Check_Items`) ↔ 歷史流水表 (`Audit_Logs` / `Audit_Details`)」解耦架構。
2. **開閉站歧義動作徹底消除 (120 項修訂)**：
   - 原始表格中「A1黑龍」、「投影機」在營業前與營業後同名，無法辨識開或關。
   - 全面精確化：
     - 黑龍：開店為「黑龍拉上」，閉店為「黑龍拉開」。
     - 展區投影機/電腦/空調：開店為「開啟確認」，閉店為「關閉確認」。
     - 門市燈具插座：明確註記「-開啟」或「-關閉」。
3. **用語標準化為「零找金」**：
   - 全面統整服務台與各門市用語，一律命名為「零找金」。
   - 取消輸入數值金額，採純勾選確認；若有異常直接登錄交接備忘。
4. **執行頻率方案 (方案 A 落地)**：
   - 引入 `Frequency` 欄位（`DAILY`, `HOLIDAY`, `EVERY_3_DAYS`, `BIWEEKLY_MON`, `BIMONTHLY`, `CONTINUOUS`），避免非每日項目在每天跳出造成現場困擾。
5. **門市與業務團隊權限綁定鐵律**：
   - **本小舖雙向綁定**：只要是本舖的人員，同時必定擁有小舖權限；小舖同仁亦然。
   - **MSS 團隊**：涵蓋 `MSS1` (旗艦一店), `MSS2` (旗艦二店), `YUANPIN` (原品)。
   - **GAGU 團隊**：涵蓋 `GAGOO`, `BAOQINGZHU` (保青竹), `YUANPIN` (原品)。
   - **服務台團隊**：涵蓋 `DIY`, `1F`, `B1`, `8F`。
   - **極限組 6 人特別名單**：吳泓邑、陳哲胤、廖記偵、簡聖儒、廖玟溱、彭子芩 額外涵蓋 `EXTREME` 權限。
6. **10 月離職同仁權限清理**：
   - 離職同仁（鄭佳驊、陳子萱、王永欣、施佩萱、黃英榤）於 `Users` 標記為 `DISABLED`，並自 `User_Depts` 中完全剔除，確保零安全隱患。

---

## 🚀 二、 2026-10-12 開發進度與已完成項目

### ✅ 階段 1：Google Sheets 資料庫與 Apps Script 初始化（已完成）
- **關聯試算表**：主巡檢資料庫（ID 請參照離線 `.env` 檔案中之 `SPREADSHEET_ID`）
- **Apps Script 專案**：Babbuza Checklist App（Script ID 請參照離線 `.env` 檔案中之 `SCRIPT_ID`）
- **10 張核心表全部建置**：`Departments`, `Users`, `User_Depts`, `Check_Items`, `Calendar`, `Audit_Logs`, `Audit_Details`, `Handover_Notes`, `Admin_Logs`, `Settings`。
- **時區修正**：已將 Apps Script 時區設為 `Asia/Taipei`，並修正 1899 純時間物件轉台北時間（`10:30` / `20:00`）。

### ✅ 階段 2：GAS 後端 API 模組實作（已完成並上線）
- **`gas/Utils.js`**：加鹽 SHA-256 雜湊、7 天 Token 簽發驗證、試算表物件化讀取。
- **`gas/Auth.js`**：工號登入認證、離職人員 (`DISABLED`) 強制阻擋、變更密碼。
- **`gas/Checklist.js`**：依使用者回傳授權站點、雙向綁定、極限組權限、頻率過濾、當日完成狀態。
- **`gas/Audit.js`**：防重複送出、寫入 `Audit_Logs` 與 `Audit_Details` 快照、異常項目 (`NG`) 自動轉為 `Handover_Notes` 異常備忘單、格式化 LINE 巡檢通報排版文字。
- **`gas/Handover.js`**：站點交接備忘讀取、手動新增備忘、異常處理結案更新。
- **`gas/Api.js`**：統一 `doGet` 與 `doPost` 路由入口、免 Google 登入匿名存取支援。
- **自動化測試套件**：[`test_api.py`](file:///d:/Github/ReactApp/Babbuza_checklist/test_api.py) 自動讀取本地 `.env` 進行 9 大端點驗證，全部 100% 測試通過。

---

## 💻 三、 換機與異地開發 SOP (Setup Instructions)

當您換電腦或在另一台主機接手開發時，請依以下步驟操作：

### 1. 取得專案代碼
```bash
git clone https://github.com/lintoro/Babbuza_checklist.git
cd Babbuza_checklist
```

### 2. 建立本機環境變數與 Clasp 設定檔
> ⚠️ **資安提醒**：依資安規範，GitHub 上不儲存任何真實試算表 ID 與憑證，請由實體離線備份（隨身碟）貼入，或向專案負責人索取。

1. 建立 `.env`（可手動複製隨身碟備份之 `.env`，或複製 `.env.example` 後填入正確 ID）：
   ```bash
   cp .env.example .env
   ```
2. 建立 `.clasp.json`（若使用隨身碟備份直接貼至根目錄，或建立此檔案）：
   ```json
   {
     "scriptId": "<YOUR_SCRIPT_ID>",
     "rootDir": "gas",
     "parentId": "<YOUR_SPREADSHEET_ID>"
   }
   ```

### 3. Clasp 登入授權
```bash
npm install -g @google/clasp
clasp login
```
登入時請使用具備該試算表與 Apps Script 編輯權限之 Google Workspace 帳號。

### 4. 驗證目前後端連線
直接在本機執行測試腳本：
```bash
python test_api.py
```
若全部 9 個項目印出綠燈通過，代表後端 API 運作完好無缺。

### 5. 推送程式碼與發布新版
若修改了 `gas/` 內的程式碼：
```bash
clasp push -f
clasp deploy -i AKfycbyLvlKday_Z8Dz-GD5mQoRjuYmYVOESyCK5s_k6ZCYrtzMA2OqqP5IiMhwZoqiUrfGm -d "描述本次更新"
```

---

## 🎯 四、 接續工作規劃（階段 3：前端 WebApp）

下一位接手者或下次啟動時，主要工作為 **階段 3：手機優先前端介面**：

1. **工號密碼快速登入介面**：
   - 輸入工號與密碼，驗證後將 Token 暫存在 `localStorage`，維持 7 天免重複登入。
   - 首次登入若 `mustChangePwd: true`，跳出修改密碼彈窗。
2. **站點與時段選擇器**：
   - 頂部站點下拉選單（自動過濾為該員授權之站點，若為本小舖同仁可秒切本舖/小舖）。
   - 「營業前 (開站)」與「營業後 (閉站)」分頁切換卡片。
3. **點檢表單與分類手風琴 (Accordion)**：
   - 按 `Category`（如 AG2, POS, 場域, 設備）分組摺疊。
   - 提供「全部正常」一鍵全選按鈕，節省現場時間。
   - 項目可選 `正常 (OK)` / `異常 (NG)` / `不適用 (NA)`。
   - 選 `NG` 時自動展開「異常備註」文字框。
4. **交接備忘與通報文字一鍵複製**：
   - 提供輸入「今日交接事項」欄位。
   - 送出成功後彈出確認對話框，附帶 **「一鍵複製 LINE 通報訊息」** 按鈕，現場人員點擊即可直接貼至 LINE 工作群組。

---

## 🔒 五、 資安與開發守則

1. **強制繁體中文（台灣）**：所有文件、註解、UI 介面一律使用正體中文。
2. **密碼資安**：密碼嚴禁明文寫入 Sheets，一律透過加鹽 SHA-256 雜湊處理。
3. **資料庫權限隔離**：現場同仁手機一律透過 WebApp API 操作，試算表本體絕不開放員工共用編輯權限。
4. **Google 帳號移轉公用帳號 SOP**：
   - 當前於開發帳號建立主試算表。
   - 移交公用帳號時：將 Google Drive 上的試算表**共用並移轉擁有權 (Transfer Ownership)** 至公用帳號。
   - 在公用帳號開啟試算表擴充功能 > Apps Script，重新部署為 Web App 即可，程式邏輯零修改。
