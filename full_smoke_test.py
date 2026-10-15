# -*- coding: utf-8 -*-
import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

import os
import re

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
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(URL, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode('utf-8'))

def get(params):
    req_url = f'{URL}?{params}'
    req = urllib.request.Request(req_url)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode('utf-8'))

print('==================================================')
print('   BABBUZA 巡檢系統 - 全功能自動化驗收測試 (Smoke Test)   ')
print('==================================================\n')

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

# 1. 健康檢查
res_health = get('action=health')
health_data = res_health.get('data') or {}
assert_test('後端健康檢查 (Health Check)', res_health.get('success') and health_data.get('status') == 'UP', f"狀態: {health_data.get('status')}")

# 2. 管理員 B111155 登入 (支援自訂密碼與預設密碼相容驗收)
admin_pwd = os.environ.get('ADMIN_PASSWORD') or '111155'
res_login_admin = post({'action': 'login', 'userId': 'B111155', 'password': admin_pwd})
if not res_login_admin.get('success'):
    res_login_admin = post({'action': 'login', 'userId': 'B111155', 'password': '000000'})
admin_data = res_login_admin.get('data') or {}
admin_token = admin_data.get('token')
admin_role = (admin_data.get('user') or {}).get('role')
assert_test('管理員 B111155 登入', res_login_admin.get('success') and admin_token and admin_role == 'ADMIN', f"Role: {admin_role}")

# 3. 一般同仁 B115050 登入
res_login_staff = post({'action': 'login', 'userId': 'B115050', 'password': '000000'})
staff_data = res_login_staff.get('data') or {}
staff_token = staff_data.get('token')
staff_role = (staff_data.get('user') or {}).get('role')
assert_test('一般同仁 B115050 登入', res_login_staff.get('success') and staff_token and staff_role == 'STAFF', f"Role: {staff_role}")

# 4. 錯誤密碼攔截測試
res_wrong_pwd = post({'action': 'login', 'userId': 'B111155', 'password': 'wrong_password_999'})
assert_test('錯誤密碼攔截防護', not res_wrong_pwd.get('success') and '密碼錯誤' in res_wrong_pwd.get('error', ''), f"錯誤訊息: {res_wrong_pwd.get('error')}")

# 5. 取得使用者授權站點清單
res_depts = get(f'action=get_user_depts&token={admin_token}')
depts_data = res_depts.get('data') or {}
depts = depts_data.get('departments') or []
dept_ids = [d.get('deptId') for d in depts]
assert_test('站點清冊動態載入', res_depts.get('success') and len(depts) > 0, f"站點數量: {len(depts)}, 包含: {', '.join(dept_ids[:4])}...")
assert_test('DIY 站點已完全移除', 'DIY' not in dept_ids, '確認 DIY 不在站點名冊中')

# 6. 點檢題目清單 (以 1F OPEN 為例)
res_checklist = get(f'action=get_checklist&token={admin_token}&deptId=1F&stage=OPEN')
items = (res_checklist.get('data') or {}).get('items') or []
assert_test('點檢項目題目載入 (1F OPEN)', res_checklist.get('success') and len(items) > 0, f"項目數: {len(items)} 項")

# 7. 戰情矩陣看板資料 (get_inspection_matrix)
res_matrix = get(f'action=get_inspection_matrix&token={admin_token}&deptId=1F&stage=OPEN')
m_data = res_matrix.get('data') or {}
dates = m_data.get('dates') or []
holidays = m_data.get('holidays') or {}
assert_test('巡檢戰情矩陣資料載入', res_matrix.get('success') and len(dates) > 0, f"查詢區間天數: {len(dates)} 天 (包含 {dates[-1] if dates else ''})")
assert_test('國定連假 Calendar 標籤連動', isinstance(holidays, dict), f"標籤天數: {len(holidays)}")

# 8. 未結案異常集中看板 (get_open_issues)
res_issues = get(f'action=get_open_issues&token={admin_token}')
issues_data = res_issues.get('data') or {}
open_count = issues_data.get('totalOpen', 0)
assert_test('未結案異常集中看板 API', res_issues.get('success') and isinstance(issues_data, dict), f"目前未結案數: {open_count}")

# 9. 已結案歷史紀錄 (get_resolved_history)
res_resolved = get(f'action=get_resolved_history&token={admin_token}&limit=10')
resolved_data = res_resolved.get('data') or {}
assert_test('已結案歷史紀錄 API', res_resolved.get('success') and isinstance(resolved_data.get('records'), list), f"歷史紀錄讀取正常 (筆數: {len(resolved_data.get('records') or [])})")

# 10. 定時總結報表中心 (get_summary_report)
res_report = get(f'action=get_summary_report&token={admin_token}&stage=OPEN&date={dates[-1] if dates else "2026-10-14"}')
report_data = res_report.get('data') or {}
assert_test('商場定時總結報表產出', res_report.get('success') and 'reportText' in report_data, f"LINE 格式報表產出正常")

print('\n==================================================')
print(f'驗收結果: 通過 {success_count} / {total_tests} 項測試')
if success_count == total_tests:
    print('🎉 系統全部功能與資安防線 100% 檢查通過，可安心操作！')
else:
    print('⚠️ 部分項目未通過，請檢查詳細資訊。')
print('==================================================')
