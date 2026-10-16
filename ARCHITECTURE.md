# Babbuza Checklist 系統架構與資料表規格 (Architecture Specification)

本文件定義後端資料庫（Google Sheets）結構、角色權限劃分與業務邏輯規則。

---

## 一、 角色與權限模型 (RBAC)

1. **`STAFF` (現場同仁)**：
   - 僅能存取 `User_Depts` 表中指派給該同仁的站點。
   - 具備開站（`OPEN`）與閉站（`CLOSE`）之檢核、送出、查看歷史與一鍵複製通報文字之權限。
2. **`SUPERVISOR` (巡店主管)**：
   - 預設具備全商場 12 個站點之查核與覆核權限。
3. **`ADMIN` (系統管理員)**：
   - 具備完整後台維護權限，包含人員增修 (`Users`)、站點增修 (`Departments`) 與點檢項目增修 (`Check_Items`)。

---

## 二、 站點與團隊群組劃分

全商場共包含 12 個標準站點代碼 (`Dept_ID`)：
- **服務台**：`1F` (1F服務台), `B1` (B1服務台), `8F` (8F服務台), `DIY` (DIY活動區)
- **MSS 團隊**：`MSS1` (旗艦一店), `MSS2` (旗艦二店), `YUANPIN` (原品)
- **GAGU 團隊**：`GAGOO`, `BAOQINGZHU` (保青竹), `YUANPIN` (原品)
- **本小舖團隊**：`BENPU` (本舖), `XIAOPU` (小舖) —— **雙向綁定**
- **勇氣體驗/設施**：`EXTREME` (極限組)

> **極限組特別指派人員**：
> 極限運動場專業教練群同仁，額外具備 `EXTREME` 站點之檢核權限。

---

## 三、 Google Sheets 資料表結構 (10 張核心表)

### 1. `Departments` (站點主檔)
| 欄位名稱 | 型態 | 說明 | 範例 |
| :--- | :--- | :--- | :--- |
| `Dept_ID` | 文字 | 站點唯一代碼 (主鍵) | `1F`, `MSS1` |
| `Dept_Name` | 文字 | 顯示名稱 | `1F服務台`, `MSS1` |
| `Dept_Type` | 選項 | `SERVICE` / `EXHIBIT` / `SHOP` | `SERVICE` |
| `Open_Deadline` | 時間 | 營業前點檢截止時間 | `10:30` |
| `Close_Deadline` | 時間 | 營業後點檢截止時間 | `20:00` |
| `Sort_Order` | 數字 | 排序序號 | `10` |
| `Is_Active` | 布林 | 是否啟用 | `TRUE` |

### 2. `Users` (人員帳號主檔)
| 欄位名稱 | 型態 | 說明 | 範例 |
| :--- | :--- | :--- | :--- |
| `User_ID` | 文字 | 員工編號 (主鍵) | `B110001` |
| `Name` | 文字 | 員工全名 | `王大明` |
| `Role` | 選項 | `STAFF` / `SUPERVISOR` / `ADMIN` | `STAFF` |
| `Password_Hash` | 文字 | 加鹽雜湊後密碼 (SHA-256) | `3f4c...` |
| `Salt` | 文字 | 隨機鹽值 | `a8Kq...` |
| `Must_Change_Pwd`| 布林 | 首次登入強制改密碼 | `TRUE` |
| `Token_Version` | 數字 | 權杖版本 (重設時+1作廢舊Token) | `1` |
| `Status` | 選項 | `ACTIVE` (在職) / `DISABLED` (離職停用) | `ACTIVE` |
| `Last_Login` | 時間 | 最後登入時間戳記 | `2026-10-12 09:15:00` |
| `Created_At` | 時間 | 帳號建立時間 | `2026-10-12` |
| `Updated_At` | 時間 | 最後異動時間 | `2026-10-12` |

### 3. `User_Depts` (人員站點授權關係表)
| 欄位名稱 | 型態 | 說明 | 範例 |
| :--- | :--- | :--- | :--- |
| `User_ID` | 文字 | 員工編號 | `B110002` |
| `Dept_ID` | 文字 | 可執行站點代碼 | `BENPU` |
| `Is_Primary` | 布林 | 登入後預設進入之主站點 | `TRUE` |
| `Is_Active` | 布林 | 權限是否有效 | `TRUE` |

### 4. `Check_Items` (點檢項目字典庫，共 571 項)
| 欄位名稱 | 型態 | 說明 | 範例 |
| :--- | :--- | :--- | :--- |
| `Item_ID` | 文字 | 項目編碼 | `ITM-0001` |
| `Dept_ID` | 文字 | 所屬站點代碼 | `1F` |
| `Stage` | 選項 | `OPEN` (營業前) / `CLOSE` (營業後) | `OPEN` |
| `Category` | 文字 | 類別 / 次分區 / 展區 | `POS` |
| `Title` | 文字 | 檢核動作說明 | `開機確認結帳日期正確` |
| `Item_Type` | 選項 | `CHECK` (純勾選) | `CHECK` |
| `Frequency` | 選項 | `DAILY` / `HOLIDAY` / `EVERY_3_DAYS` / `BIWEEKLY_MON` / `BIMONTHLY` / `CONTINUOUS` | `DAILY` |
| `Applicable_Days`| 選項| `DAILY` / `WORKDAY` / `HOLIDAY` | `DAILY` |
| `Sort_Order` | 數字 | 顯示順序 | `10` |
| `Is_Active` | 布林 | 是否啟用 (軟刪除) | `TRUE` |
| `Updated_By` | 文字 | 最後修改人 | `IMPORT` |
| `Updated_At` | 時間 | 最後修改時間 | `2026-10-12` |

### 5. `Calendar` (特殊行事曆與休館日)
* 欄位：`Date`, `Day_Type` (`HOLIDAY` / `CLOSED`), `Dept_ID`, `Note`。

### 6. `Audit_Logs` (點檢送出紀錄表頭)
* 欄位：`Log_ID`, `Biz_Date`, `Dept_ID`, `Stage`, `Version`, `Is_Current`, `Correction_Reason`, `Executor_ID`, `Executor_Name`, `Submit_Time`, `Deadline`, `Is_Late`, `Total_Count`, `OK_Count`, `NG_Count`, `NA_Count`, `Client_Key`。

### 7. `Audit_Details` (點檢明細快照)
* 欄位：`Log_ID`, `Item_ID`, `Category_Snapshot`, `Title_Snapshot`, `Status` (`OK`/`NG`/`NA`), `Value`, `Remark`。

### 8. `Handover_Notes` (異常通報與交接備忘)
* 欄位：`Note_ID`, `Biz_Date`, `Dept_ID`, `Type`, `Source_Log_ID`, `Source_Item_ID`, `Content`, `Reporter_ID`, `Assignee_ID`, `Status`, `Resolution`, `Resolved_By`, `Resolved_At`, `Created_At`。

### 9. `Admin_Logs` (後台稽核軌跡)
* 欄位：`Time`, `Operator_ID`, `Action`, `Target_Table`, `Target_ID`, `Before`, `After`。

### 10. `Settings` (系統設定參數)
* 收錄 `TOKEN_DAYS` (7天), `LOGIN_MAX_FAIL` (5次), `LOGIN_LOCK_MIN` (15分鐘), `PWD_MIN_LEN` (6碼), `PWD_MAX_LEN` (8碼) 等。
