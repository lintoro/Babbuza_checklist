# Babbuza 專案代理人與接手規範 (Workspace Rules for AI & Engineers)

歡迎接手 Babbuza 商場巡檢系統專案。本文件為本專案最高優先級規範，任何 AI 代理人或開發者進入本工作區時，必須最先讀取並嚴格遵守以下準則。

---

## 🔒 第一鐵律：資安全面檢核關卡 (Security Gate 0 - Absolute Zero-Secret Policy)

**在執行任何功能開發、問題修正、異地交接或 Git 提交之前，第一步必須執行資安檢核！**

### 1. 嚴禁任何明文金鑰外洩至儲存庫 (Zero Plaintext Secrets)
* **禁止提交機敏檔案**：`.env`, `.env.*`, `*.key`, `*.pem`, `.clasp.json`, `.clasprc.json` 必須保持在 `.gitignore` 內，嚴禁 `git add`。
* **禁止硬編碼 (Hardcoding)**：
  - 嚴禁在任何程式碼、測試腳本（如 `full_smoke_test.py`）、說明文件、交接手冊（`PROJECT_HANDOVER.md`）中寫死真實的 Google Sheet ID、Apps Script 專案 ID、Web App 部署 URL、後端 Token 或帳號密碼。
  - 所有文件範例必須一律使用標準佔位符（如 `<YOUR_SPREADSHEET_ID>`、`<YOUR_WEB_APP_URL>`、`<ADMIN_USER_ID>`）。
  - 生產環境機敏參數僅能透過實體隨身碟離線交付或雲端平台（如 Render Dashboard）後台注入。

### 2. 接手與結案第一動作：強制檢核指令 (Handover Checkpoints)
在接手專案開始工作前，以及完成任務準備結案前，必須依序執行以下檢驗指令：

```bash
# 1. 確認受控檔案無任何真實 .env 或機敏檔案
git ls-files | Select-String "^\.env"
# 預期輸出：僅有 .env.example

# 2. 確認工作目錄與暫存區未被污染
git status

# 3. 執行全量煙道測試，確認後端與資安防護正常 (含沙盒模式隔離驗收)
python full_smoke_test.py
```

---

## 🧪 第二鐵律：沙盒測試與零污染隔離規範 (Sandbox Testing & Zero-Pollution Policy)

**商場現已處於試營運與正式使用階段，任何本地開發、換機測試或自動化腳本驗收，絕不允許污染正式環境！**

### 1. 本地開發與自動化測試強制沙盒標記
* **自動沙盒前綴**：
  - 本地前端 (`localhost` / `127.0.0.1`) 送出點檢時，程式碼自動注入 `isTest: true` 與 `clientKey: TEST-...`。
  - 任何測試腳本送出之日誌，其 ID 必須帶有 `TEST-LOG-`，禁止使用生產前綴 `LOG-`。
* **後端零干擾隔離**：
  - 後端系統在計算「今日站點點檢完成狀態（`getDepartmentStatus`）」、「戰情打勾矩陣（`getInspectionMatrix`）」、「定時 LINE 總結報表（`generateSummaryReport`）」時，**一律自動排除 `isTest: true` 或 `clientKey` 帶有 `TEST-` 的紀錄**。
  - **一般同仁手機與電腦端完全無感，絕不會看到測試時段被勾選或顯示「已完成」，也不會流入任何測試異常備忘**。

### 2. 測試紀錄即時銷毀與定期清理
* **即時銷毀 (Tear-down)**：自動化測試腳本在驗證完畢後，應優先呼叫 `admin_remove_audit_log` 執行三表聯動（`Audit_Logs`、`Audit_Details`、`Handover_Notes`）物理銷毀。
* **手動清理工具**：若需清理特定測試單號，執行 `python cleanup_test_data.py <LOG_ID>`。
* **換機交接要求**：任何開發者換機接案時，必須於新環境確認此沙盒機制正常運作，嚴禁對生產資料庫直推非沙盒假數據。

---

## 🌐 語言規範 (Language Policy)
1. 所有與使用者的對話溝通、報告、文件撰寫、問題日誌更新，必須 100% 使用**繁體中文（台灣）**。
2. 嚴禁使用簡體中文。
3. 程式碼中的註解原則上使用繁體中文。

---

## 📜 標準交接維護 SOP
每次異地開發結束或功能交付時，必須同步維護以下核心文件：
1. `PROJECT_HANDOVER.md`：專案交接手冊（首章必須保持資安檢核關卡）。
2. `ISSUES_LOG.md`：歷史問題與排查修正日誌。
3. `PROGRESS.md`：功能進度與對照表。
