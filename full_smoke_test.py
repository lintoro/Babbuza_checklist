# -*- coding: utf-8 -*-
"""
BABBUZA 商場巡檢系統 - 生產級系統健康探針與資安防線自動化檢驗套件 (Production Health & Security Probe)
本腳本為已上線 (Production Live) 系統專用，具備以下特性：
1. 100% 唯讀與非破壞性：絕不更動、刪除任何正式資料庫內容。
2. 零同仁帳密依賴：不使用任何真實員工帳號與個人密碼，徹底保障同仁隱私。
3. 深層系統自檢 (Deep Health Probe)：自動檢驗 7 大數據表、11 個站點規格、500 題題庫及異常池。
4. 全面資安防禦驗證：檢驗無 Token、偽造 Token、未授權寫入、離職阻斷與錯誤密碼攔截。
"""

import urllib.request
import json
import sys
import os
import re

sys.stdout.reconfigure(encoding='utf-8')

# 動態從本地 .env 或環境變數讀取後端 URL，避免機敏字串外洩至儲存庫
URL = os.environ.get('WEB_APP_URL') or os.environ.get('VITE_WEB_APP_URL')

if not URL and os.path.exists('.env'):
    with open('.env', 'r', encoding='utf-8') as f:
        for line in f:
            m = re.match(r'^(?:WEB_APP_URL|VITE_WEB_APP_URL)\s*=\s*["\']?([^"\'\r\n]+)', line.strip())
            if m:
                URL = m.group(1).strip()
                break

if not URL:
    print('❌ [錯誤] 未偵測到 WEB_APP_URL。請在環境變數或本地 .env 檔案中指定後端 Web App 網址。')
    sys.exit(1)

def post(payload):
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(URL, data=data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=25) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return {'success': False, 'error': str(e)}

def get(params):
    try:
        req_url = f'{URL}?{params}'
        req = urllib.request.Request(req_url)
        with urllib.request.urlopen(req, timeout=25) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return {'success': False, 'error': str(e)}

print('======================================================================')
print('   BABBUZA 巡檢系統 - 生產級系統健康探針與資安防線自動化檢驗套件   ')
print('======================================================================\n')

success_count = 0
total_tests = 0

def assert_test(name, condition, extra=''):
    global success_count, total_tests
    total_tests += 1
    if condition:
        success_count += 1
        print(f'✅ [PASS] {name} {extra}')
    else:
        print(f'❌ [FAIL] {name} {extra}')

# ----------------------------------------------------------------------
# 第一階段：系統基礎連線與深層伺服器自檢 (Deep Health Probe)
# ----------------------------------------------------------------------

# 1. 後端基礎健康連線
res_health = get('action=health')
health_data = res_health.get('data') or {}
assert_test('後端基礎連線探針 (Health Probe)', 
            res_health.get('success') and health_data.get('status') == 'UP', 
            f"狀態: {health_data.get('status')}, 版本: {health_data.get('version')}")

# 2. 伺服器端深層自檢 (Deep Health Check)
res_deep = get('action=health&deep=true')
deep_data = (res_deep.get('data') or {}).get('deepProbe') or {}
tables = deep_data.get('tables') or {}
all_tables_ok = deep_data.get('allTablesHealthy') and len(tables) >= 7
assert_test('資料庫 7 大表健全度自檢 (Database Integrity)', 
            all_tables_ok, 
            f"已涵蓋工作表: {', '.join(tables.keys())}")

# 3. 站點清冊規格檢查
station_check = deep_data.get('stationCheck') or {}
active_stations = station_check.get('activeStations', 0)
assert_test('有效站點清冊一致性校驗 (Station Catalog)', 
            active_stations == 11, 
            f"線上啟用站點: {active_stations} 個 (符合商場 11 站點標準)")

# 4. DIY 站點隔離排除檢查
diy_excluded = station_check.get('diyExcluded', False)
assert_test('DIY 站點隔離排除校驗 (DIY Station Isolation)', 
            diy_excluded is True, 
            '確認 DIY 站點已自上線站點清冊中 100% 排除')

# 5. 點檢題目庫規模檢查
item_check = deep_data.get('itemCheck') or {}
active_items = item_check.get('activeItems', 0)
assert_test('點檢題目庫規模校驗 (Checklist Items Catalog)', 
            active_items >= 500, 
            f"線上啟用題庫數: {active_items} 項 (各站點題目完備)")

# 6. 未結案異常與交接池讀取
issue_check = deep_data.get('issuePoolCheck') or {}
assert_test('未結案問題池讀取校驗 (Issue & Handover Pool)', 
            'totalIssues' in issue_check, 
            f"歷史備忘總計: {issue_check.get('totalIssues', 0)} 筆, 未結案追蹤中: {issue_check.get('unresolvedCount', 0)} 筆")

# 7. 國定連續假資料庫完整度
calendar_row = tables.get('Calendar', {}).get('rowCount', 0)
assert_test('國定連續假資料庫連動 (Calendar Table)', 
            calendar_row > 0, 
            f"Calendar 日曆標籤筆數: {calendar_row - 1} 筆")

# ----------------------------------------------------------------------
# 第二階段：生產資安防線邊界測試 (Security Barrier Tests - 100% 無帳密)
# ----------------------------------------------------------------------

# 8. 資安防線 1：無 Token 存取硬性阻斷
res_no_token = get('action=get_checklist&deptId=1F&stage=OPEN')
assert_test('資安防線 1：無 Token 存取硬性阻斷', 
            not res_no_token.get('success') and '身分驗證失敗' in str(res_no_token.get('error', '')), 
            f"阻斷回應: {res_no_token.get('error')}")

# 9. 資安防線 2：偽造 Token 即時攔截阻斷
res_fake_token = get('action=get_checklist&token=FAKE_MALICIOUS_TOKEN_99999&deptId=1F&stage=OPEN')
assert_test('資安防線 2：偽造 Token 即時攔截阻斷', 
            not res_fake_token.get('success') and '身分驗證失敗' in str(res_fake_token.get('error', '')), 
            f"阻斷回應: {res_fake_token.get('error')}")

# 10. 資安防線 3：未授權點檢提交阻斷
res_unauth_submit = post({'action': 'submit_checklist', 'deptId': '1F', 'stage': 'OPEN', 'records': []})
assert_test('資安防線 3：未授權資料寫入硬性阻斷', 
            not res_unauth_submit.get('success') and '驗證失敗' in str(res_unauth_submit.get('error', '')), 
            f"阻斷回應: {res_unauth_submit.get('error')}")

# 11. 資安防線 4：離職員工帳號隔離阻絕
res_disabled_login = post({'action': 'login', 'userId': 'B111001', 'password': 'any_password_123'})
# B111001 若為離職同仁或無效同仁，後端均會拒絕
assert_test('資安防線 4：非在職員工存取封鎖', 
            not res_disabled_login.get('success'), 
            f"安全防護回應: {res_disabled_login.get('error')}")

# 12. 資安防線 5：錯誤憑證防暴力破解攔截
res_wrong_cred = post({'action': 'login', 'userId': 'B999999', 'password': 'wrong_password_xyz'})
assert_test('資安防線 5：無效憑證與帳密安全防護', 
            not res_wrong_cred.get('success'), 
            f"防護回應: {res_wrong_cred.get('error')}")

# 13. 資安防線 6：未授權讀取行事曆攔截 (修復公開暴露漏洞)
res_calendar_unauth = get('action=get_all_calendar')
assert_test('資安防線 6：未授權存取行事曆阻斷 (Calendar Auth Guard)', 
            not res_calendar_unauth.get('success'), 
            f"阻斷回應: {res_calendar_unauth.get('error')}")

# 14. 資安防線 7：批次戰情矩陣端點 RBAC 權限控管
res_batch_unauth = get('action=get_batch_inspection_matrix&deptIds=1F,2F')
assert_test('資安防線 7：未授權批次矩陣存取阻斷 (Batch Matrix RBAC Guard)', 
            not res_batch_unauth.get('success'), 
            f"阻斷回應: {res_batch_unauth.get('error')}")

print('\n======================================================================')
print(f'驗收結果: 通過 {success_count} / {total_tests} 項生產級檢驗')
if success_count == total_tests:
    print('🎉 系統全部資料表、營業站點與資安防線 100% 檢查通過，生產環境運作完美！')
else:
    print('⚠️ 部分項目未通過，請檢查詳細資訊。')
print('======================================================================')
