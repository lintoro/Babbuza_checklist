# Babbuza 商場巡檢點檢系統 (Babbuza Checklist App)

本專案為商場/文創園區各站點（服務台、展區、自營門市櫃位、體驗組）之日常巡檢、開閉站檢核、異常回報與交接通報系統。

> [!IMPORTANT]
> ### 🔒 最高資安要求與交接第一道檢核關卡 (Security Gate 0)
> 本專案受本機全域最高規則與 [`AGENTS.md`](file:///c:/Github/ReactApp/Babbuza_checklist/AGENTS.md) 嚴格約束，實施**零明文金鑰原則 (Zero Plaintext Secrets)**：
> 1. **嚴禁推上任何金鑰與真實 ID**：儲存庫內嚴禁出現任何真實 Google Sheet ID、GAS 專案 ID、部署 URL 或密碼。
> 2. **交接第一步全面檢查**：任何工程師或 AI 接手本專案，請先參閱 [`PROJECT_HANDOVER.md`](file:///c:/Github/ReactApp/Babbuza_checklist/PROJECT_HANDOVER.md) 之「第 0 章：資安全面清查確認關卡」，確認環境檔案未受追蹤且程式碼無機敏殘留。

---

## 📌 系統核心規格

- **前端**：響應式 RWD WebApp（適配手機端），支援工號密碼登入、自動識別站點權限、一鍵複製回報訊息。
- **後端**：Google Apps Script (GAS) Web App API。
- **資料庫**：Google Sheets（Master DB），收錄各站點點檢項目字典、人員帳號、站點授權與巡檢歷史紀錄。
- **資安與隔離機制**：
  - 密碼加鹽雜湊 (Salted SHA-256)，禁止明文儲存。
  - Token-based 認證機制，登入狀態保持 7 天。
  - 離職同仁帳號自動標記 `DISABLED`，完全移除站點存取權限。
  - 敏感資料庫僅限管理者存取，前端僅能透過 API 讀寫，防範公式注入與資料篡改。

---

## 📂 目錄結構

```
Babbuza_checklist/
├── .env.example              # 環境變數範本
├── .gitignore                # Git 忽略設定
├── README.md                 # 專案概覽說明
├── ARCHITECTURE.md           # 系統架構規格與資料庫表定義
├── PROJECT_HANDOVER.md       # 換機開發與交接手冊（記錄討論歷程、重要決策與異地開發指引）
├── ISSUES_LOG.md             # 歷史問題與修正日誌
├── package.json              # 前端套件依賴與腳本
├── vite.config.js            # Vite 設定檔 (環境變數注入與路徑配置)
├── tailwind.config.js        # TailwindCSS 樣式設定
├── index.html                # 網頁進入點 (手機螢幕縮放與 PWA 準備)
├── src/                      # 前端原始碼目錄 (React 18)
│   ├── main.jsx              # React 進入點
│   ├── App.jsx               # 主頁面流程與狀態串接
│   ├── index.css             # 全域樣式與 Tailwind 載入
│   ├── api.js                # 前端與 GAS 後端通訊模組 (GET/POST CORS 封裝)
│   ├── context/
│   │   └── AuthContext.jsx   # 認證與使用者狀態管理 (7天免登入)
│   └── components/
│       ├── Navbar.jsx        # 頂部導覽列 (使用者、改密碼、重整、登出)
│       ├── LoginModal.jsx    # 工號密碼登入
│       ├── ChangePasswordModal.jsx # 密碼修改 (首次強制/自由變更)
│       ├── StationSelector.jsx     # 站點切換與開閉站狀態卡片
│       ├── HandoverCard.jsx        # 即時交接備忘與未結案異常卡片
│       ├── ChecklistSection.jsx    # 點檢項目 (手風琴/一鍵OK/三態/NG備註)
│       └── SubmitModal.jsx         # 送出成功與 LINE 通報一鍵複製
├── test_api.py               # 後端 API 9 大核心端點自動化整合測試套件
└── gas/                      # Google Apps Script 原始碼目錄
    ├── appsscript.json       # GAS 專案設定檔 (時區 Asia/Taipei，啟用 WebApp 匿名存取)
    ├── Utils.js              # 加鹽 SHA-256、7天 Token 簽發驗證、時區與試算表工具
    ├── Auth.js               # 工號登入、離職阻擋、密碼修改模組
    ├── Checklist.js          # 站點權限、雙向綁定、極限組名單、頻率過濾引擎
    ├── Audit.js              # 點檢送出、防重複、多版本補登、異常備忘轉錄、LINE通報產出
    ├── Handover.js           # 異常與交接備忘讀取、新增與結案更新
    ├── Api.js                # doGet 與 doPost 統一進入點
    └── InitDatabase.js       # Master DB 一鍵建表與種子資料匯入腳本
```

---

## 🚀 快速開始與異地開發

1. 取得專案代碼：
   ```bash
   git clone https://github.com/lintoro/Babbuza_checklist.git
   cd Babbuza_checklist
   ```
2. 複製設定檔：
   ```bash
   cp .env.example .env
   ```
3. 建立 `.clasp.json` 並登入 clasp：
   ```bash
   npm install -g @google/clasp
   clasp login
   ```
4. 驗證目前後端連線狀態：
   ```bash
   python test_api.py
   ```
5. 詳細換機與移轉說明請參閱 [PROJECT_HANDOVER.md](PROJECT_HANDOVER.md)。
