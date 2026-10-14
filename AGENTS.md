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

# 3. 執行全量煙道測試，確認後端與資安防護正常
python full_smoke_test.py
# 預期輸出：通過 12 / 12 項測試
```

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
