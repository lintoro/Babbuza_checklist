# 專案交接與換機維運手冊 (Project Handover & Operations Guide)

本手冊供後續維護、換機接手或 AI Agent 快速銜接專案。記錄了從原始各分頁試算表演進至標準化 WebApp 的核心架構、最新開發進度與異地開發指引。

> [!CAUTION]
> ### 🚨 第 0 章：交接與接手第一步：資安全面清查確認關卡 (Security Gate 0 - Mandatory Check)
> **本專案實施最高等級「零明文金鑰原則 (Zero Plaintext Secrets)」。無論是換機接手、AI 代理人接管、或結案移交，執行任何指令或閱讀後續文件前，第一步必須執行資安全面檢核！**
> 
> #### 📋 移交／接手第一步強制檢核清單 (Handover Checkpoints)
> 1. **檢查受控檔案名冊**：
>    ```bash
>    git ls-files | Select-String "^\.env"
>    ```
>    *合格標準：輸出僅允許有 `.env.example`。若出現 `.env` 或 `.env.production` 等真實檔案，嚴禁推送並立即通報！*
> 2. **清查程式碼與文件明文金鑰**：
>    ```bash
>    git grep -i "script.google.com/macros/s/AKfy"
>    ```
>    *合格標準：返回值為 0 匹配（Code 1）。程式碼與手冊中絕對嚴禁寫死真實部署 URL。*
> 3. **確認 Git 追蹤狀態**：
>    ```bash
>    git status
>    ```
>    *合格標準：確認未追蹤任何 `.clasp.json`、憑證檔或含有密碼的金鑰檔。*
> 4. **實體離線交接確認**：
>    *生產環境的實際 `SPREADSHEET_ID`、`SCRIPT_ID` 與 `WEB_APP_URL`，僅能自離線實體隨身碟複製到本機 `.env`，嚴禁推送到任何公開儲存庫！*

---

## 📌 一、 專案核心架構與部署規範

* **專案儲存庫**：`https://github.com/lintoro/Babbuza_checklist.git`（分支：`main`）
* **後端架構**：Google Apps Script (GAS) Web App + Google Sheets 關聯式資料庫
  * **Google Apps Script 專案**：可透過 `.clasp.json` 連接（設定範本見下文）
  * **主試算表架構**：包含 Stations, Users, Items, Logs, Issues, Calendar 等標準標準化資料表
  * **最新生產環境部署**：**`@37`**（全後端快取、批次 I/O、消除 N+1 讀表、RBAC 三階管理權限控管與防公式注入；前端 Code Splitting 與單一請求匯出）
* **前端託管平台**：**Render** (Static Site)
  * **設定檔**：根目錄已配置 `render.yaml` 與 `.env.example`
  * **環境變數注入**：由 Render 後台 Dashboard 安全注入 `VITE_WEB_APP_URL`
  * **建置指令**：`npm install && npm run build`
  * **發布目錄**：`dist`
  * **SPA 重定向**：`/*` ➜ `/index.html` (Rewrite)
* **系統三階角色與權限規範**：
  * **STAFF (現場同仁)**：現場開閉店打勾點檢、提報異常與現場交接，無後台管理權限。
  * **SUPERVISOR (巡店主管)**：開放後台戰情中心（打勾矩陣/Excel 匯出）、未結案異常督辦、定時 LINE 總結報表產出、以及【點檢項目規格】維護（增修、排序、開關）。
  * **ADMIN (系統管理員)**：具備全功能，且獨家掌管【站點規格與連假同步】與【人員名冊管理/密碼重設】。
  * **密碼安全防護**：首次登入或密碼被重設後，系統強制要求修改為 6～8 碼之自訂新密碼，登入支援記住工號。

---

## 🚀 二、 系統模組架構與功能清單

### 1. 現場同仁巡檢端 (Staff View)
* **站點與時段選擇**：
  * 自動載入同仁授權之站點（管理員涵蓋全 11 個站點）。
  * 雙向切換【營業前（開店）】與【營業後（閉店）】。
  * **營業時間嚴格防護**：
    * 開店開放時間：`09:30 ~ 10:30`
    * 閉店開放時間：`16:45 ~ 20:00`
    * 未到開放時間（例如下午 14:00 想填閉店），按鈕全面置灰鎖定，後端硬性攔截阻斷。
* **點檢項目填報**：
  * 依 Category 分組展示題目，支援合格（OK）、異常（NG）、不適用（NA）。
  * 題目支援「一鍵全打勾（全部合格）」極速填報。
  * 遇 NG 異常強制要求填寫異常說明，並在送出時**自動轉成未結案異常備忘單**。
* **站點即時備忘與交接卡片**：
  * 隨選隨看該站點未結案異常與交接事項。
  * 任何人皆可點擊「結案核銷」（可直接核銷免填說明）。
  * 點擊「結案紀錄」彈窗可調閱已結案歷史。

### 2. 管理後台中心 (Admin Center - 5 大功能模組)
* **模組 1：巡檢戰情矩陣 (`AdminWarRoomView`)**：
  * 完整呈現 15 天滾動式 Excel 矩陣看板（打勾、人員、送出時間、連假標籤）。
  * **雙分頁 Excel 匯出 (目前單位)**：一鍵下載包含【營業前 (開店)】與【營業後 (閉店)】完整打勾、人員與精確送出時間雙工作表之單一 `.xlsx` 檔案。
  * **多單位單一綜合總表批次匯出**：彈窗預設全選，可勾選指定站點，將所選各站點之開店與閉店工作表整合進**單一 Excel 檔案**下載（絕無分檔 ZIP 困擾）。
  * **未結案異常集中追蹤看板**：支援【🚨 設備報修】與【📋 現場交接】二級 Tab 分流（預設鎖定報修）；**現場交接逾 3 日未核銷自動歸檔**。
  * **已結案歷史紀錄查詢**：支援【🔧 設備報修】與【📋 現場交接】二級 Tab 查驗。
* **模組 2：點檢項目規格維護中心 (`AdminChecklistItemsView`)**：
  * **站點／時段雙層切換**：自由切換 11 個站點與開店/閉店時段。
  * **分類分組條列**：依類別分組展示，支援 ⬆️ / ⬇️ 快速微調順序並即時同步。
  * **完整 CRUD 功能**：新增題目、編輯題目、一鍵啟用/停用開關、刪除防呆確認。
* **模組 3：站點規格與連假中心 (`AdminStationsView`)**：
  * 管理各站點代碼、名稱、類型與上下排序。
  * 未來 3 個月國定連續假期自動檢查與一鍵確認寫入 Calendar 資料庫。
* **模組 4：人員名冊與帳號權限 (`AdminUsersView` - 僅 ADMIN)**：
  * 人員清冊管理，預設顯示全部人員 (`ALL`)，支援「全部 / 在職 / 離職留停」頁籤切換。
  * **一階角色排序**：`ADMIN` ➜ `SUPERVISOR` ➜ `STAFF`（下拉選單與清冊完全同步）。
  * **二階工號排序**：相同角色下，依工號由 B 到 A、數字由小到大（升冪）排列。
  * 在職／離職狀態切換、一鍵重設密碼（下次強制改密）、站點授權分配。
* **模組 5：商場巡檢總結報表 (`AdminReportsView`)**：
  * 產出符合商場 LINE 官方格式之巡檢進度總結文字報告，支援一鍵複製與即時導出。

---

## 🔒 三、 資安與架構規範鐵律 (Security Rules)

1. **零明文金鑰原則 (Zero Plaintext Secrets)**：
   - GitHub 儲存庫內嚴禁出現任何 Hardcoded Secret Key 或真實 Database ID。
   - 所有後端敏感金鑰儲存於 `PropertiesService.getScriptProperties()`。
   - 地端 `.env`、`.env.*` 必須納入 `.gitignore`，僅允許推 `.env.example`。
2. **密碼安全與防護**：
   - 動態加鹽 SHA-256 雜湊儲存（Salt 隨機 16 碼）。
   - 密碼長度強制規範為 **6 至 8 碼**（前後端嚴格對齊）。
3. **全路由 Token 鑑權與版本控制**：
   - 除了公開的 `login` 動作外，所有 28 條 GET 與 POST API 強制帶 `token` 驗證。
   - `Token_Version` 單一設備/密碼異動控制：改密或重設密碼時版本號 +1，前端即時同步收下 `newToken`，舊 Token 立即失效。
4. **離職人員即刻阻斷**：
   - 標記為 `DISABLED` 或 `LEAVE` 的帳號，登入與 Token 驗證即刻全面封鎖。
5. **站點時間純字串化**：
   - 站點開放時間儲存格採純文字格式（`@`），徹底免疫 Google Sheets 1899 年歷史時區扣 8 小時偏差。

---

## 💻 四、 換機與異地開發 SOP (Setup Instructions)

當您換電腦或在另一台主機接手開發時，請依以下步驟操作：

### 1. 取得專案代碼
```bash
git clone https://github.com/lintoro/Babbuza_checklist.git
cd Babbuza_checklist
npm install
```

### 2. 設定本機環境變數
請複製 `.env.example` 為 `.env`（真實數值請洽交接負責人或查閱離線隨身碟）：
```bash
cp .env.example .env
```
`.env` 內容範例：
```ini
SPREADSHEET_ID=<YOUR_SPREADSHEET_ID>
SCRIPT_ID=<YOUR_SCRIPT_ID>
WEB_APP_URL=<YOUR_WEB_APP_URL>
VITE_WEB_APP_URL=<YOUR_WEB_APP_URL>
ENV=development
```

### 3. 設定 Clasp (Google Apps Script CLI)
建立 `.clasp.json`（已加入 `.gitignore` 避免外洩）：
```json
{
  "scriptId": "<YOUR_SCRIPT_ID>",
  "rootDir": "gas",
  "parentId": "<YOUR_SPREADSHEET_ID>"
}
```
登入 Google 帳號授權：
```bash
npx @google/clasp login
```

### 4. 啟動地端開發伺服器
```bash
npm run dev
```
瀏覽器開啟 `http://localhost:3000` 即可進行開發與測試。

### 5. 執行自動化驗收測試 (生產級深層探針與資安防線檢驗)
本專案已升級為 100% 唯讀、零帳密依賴之生產級自動化檢驗套件（`full_smoke_test.py`）：
```bash
python full_smoke_test.py
```
測試內容涵蓋 14 大生產級檢查項目（零帳密依賴、不干擾線上同仁）：
* **階段一：系統深層自檢 (Deep Health Probe)**
  1. 後端基礎連線探針 (Health Probe 狀態 UP)
  2. 資料庫 7 大表健全度自檢 (Users, Departments, User_Depts, Check_Items, Audit_Logs, Handover_Notes, Calendar)
  3. 有效站點清冊一致性校驗 (線上啟用站點 11 個)
  4. DIY 站點隔離排除校驗 (100% 排除停用之 DIY 站點)
  5. 點檢題目庫規模校驗 (線上題庫 500 題完整加載)
  6. 未結案異常與交接池讀取校驗 (正常回傳待辦與歷史備忘)
  7. 國定連續假資料庫連動校驗 (Calendar 日曆標籤完整)
* **階段二：生產資安防線邊界測試 (Security Barrier Tests)**
  8. 資安防線 1：無 Token 存取硬性阻斷
  9. 資安防線 2：偽造 Token 即時攔截阻斷
  10. 資安防線 3：未授權點檢提交阻斷
  11. 資安防線 4：非在職員工存取封鎖
  12. 資安防線 5：無效憑證與密碼安全防護
  13. 資安防線 6：未授權存取行事曆阻斷 (Calendar Auth Guard)
  14. 資安防線 7：未授權批次矩陣存取阻斷 (Batch Matrix RBAC Guard)

### 6. 測試沙盒資料物理清理工具 (Zero-Trace Cleanup)
若在開發測試或試營運期間送出了測試資料，可透過以下指令進行物理銷毀：
```bash
# 清理指定日誌 ID (將連帶自 Audit_Logs, Audit_Details, Handover_Notes 三表完全抹除)
python cleanup_test_data.py <LOG_ID>

# 例如：
python cleanup_test_data.py TEST-LOG-20261015-1F-OPEN-V1
```

### 7. 後端推送與部署流程
若修改了 `gas/` 內的後端程式碼：
```bash
# 推送至 GAS
npx @google/clasp push -f

# 部署新版本
npx @google/clasp deploy -i <YOUR_DEPLOYMENT_ID> -d "版本更新描述"
```

### 8. 前端推送至 Render 自動發布
若修改了前端程式碼，推送到 GitHub `main` 分支時，Render 將自動執行 `npm run build` 並更新上線：
```bash
git add .
git commit -m "feat/fix: 更新說明"
git push origin main
```
