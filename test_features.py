# -*- coding: utf-8 -*-
import urllib.request
import json
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

def load_env():
    env_vars = {}
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env_vars[k.strip()] = v.strip()
    return env_vars

env = load_env()
url = env.get('WEB_APP_URL')
if not url:
    print('錯誤：找不到本地 .env 中的 WEB_APP_URL')
    sys.exit(1)

def post(payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def get(params):
    req_url = f'{url}?{params}'
    req = urllib.request.Request(req_url)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

print('=====================================================')
print('Babbuza Checklist - 新功能端對端自動化驗證測試')
print('=====================================================')

# 1. 登入取得 Token (自環境變數讀取或安全略過)
TEST_USER_ID = os.environ.get('TEST_USER_ID')
TEST_PASSWORD = os.environ.get('TEST_PASSWORD')
token = os.environ.get('TEST_TOKEN')

if not token and TEST_USER_ID and TEST_PASSWORD:
    print('\n[測試 1] 在職員工登入校驗')
    res_login = post({'action': 'login', 'userId': TEST_USER_ID, 'password': TEST_PASSWORD})
    token = res_login.get('data', {}).get('token')
    print('登入狀態:', res_login.get('success'))

if not token:
    print('ℹ️ [提示] 需 Token 方可執行後續功能測試，請於環境變數提供 TEST_TOKEN 或 TEST_USER_ID / TEST_PASSWORD。')
    sys.exit(0)

# 2. 站點回報開放時間與截止時間驗證
print('\n[測試 2] 站點授權與回報開始/截止時間 (get_user_depts)')
res_depts = get(f'action=get_user_depts&token={token}')
depts = res_depts.get('data', {}).get('departments', [])
print(f'取得授權站點共 {len(depts)} 站：')
for d in depts[:2]:
    print(f" - {d['deptName']} ({d['deptId']}): 開店 {d.get('openStartTime')}~{d.get('openDeadline')} | 閉店 {d.get('closeStartTime')}~{d.get('closeDeadline')}")
assert len(depts) > 0, '未取得站點'
assert 'openStartTime' in depts[0], '缺少 openStartTime'

# 3. 測試即時巡檢戰情報表矩陣 (get_inspection_matrix)
print('\n[測試 3] 巡檢戰情報表矩陣 (get_inspection_matrix - 1F服務台 營業前)')
res_matrix = get('action=get_inspection_matrix&deptId=1F&stage=OPEN')
m_data = res_matrix.get('data', {})
dates = m_data.get('dates', [])
items = m_data.get('items', [])
print(f'涵蓋日期範圍: {dates}')
print(f'項目總數: {len(items)} 項')
if items:
    sample_item = items[0]
    print(f"範例項目: [{sample_item['category']}] {sample_item['title']}")
    for d in dates[-2:]:
        rec = sample_item.get('records', {}).get(d, {})
        print(f"  日期 {d}: 執行={rec.get('executed')}, 狀態={rec.get('status')}, 執行人={rec.get('executorName')}, 時間={rec.get('submitTime')}")
assert res_matrix.get('success') == True, '取得矩陣失敗'
assert len(items) > 0, '矩陣項目為空'

# 4. 測試全商場未結案異常集中追蹤 (get_open_issues)
print('\n[測試 4] 全商場未結案異常集中追蹤 (get_open_issues)')
res_issues = get('action=get_open_issues')
issues_data = res_issues.get('data', {})
total_open = issues_data.get('totalOpen', 0)
issues_list = issues_data.get('issues', [])
print(f'全商場未結案異常總數: {total_open} 則 (設備報修: {issues_data.get("defectCount")}, 現場交接: {issues_data.get("handoverCount")})')
if issues_list:
    top_issue = issues_list[0]
    print(f"最新待處理項目: [{top_issue['deptName']}] {top_issue['content']} (提報人: {top_issue['reporterName']}, 待處理 {top_issue['pendingDays']} 天)")
assert res_issues.get('success') == True, '取得未結案異常失敗'

# 5. 測試全員核銷結案確認 (resolve_handover)
if issues_list:
    target_note = issues_list[0]
    print(f"\n[測試 5] 全員核銷結案確認 (resolve_handover - Note ID: {target_note['noteId']})")
    res_resolve = post({
        'action': 'resolve_handover',
        'token': token,
        'noteId': target_note['noteId'],
        'resolution': '自動化測試核銷：現場已排除異常並完成結案確認'
    })
    print('結案結果:', res_resolve.get('success'))
    print('結案資訊:', res_resolve.get('data'))
    assert res_resolve.get('success') == True, '核銷結案失敗'

# 6. 測試已結案歷史紀錄查詢 (get_resolved_history)
print('\n[測試 6] 已結案歷史紀錄查詢 (get_resolved_history)')
res_history = get('action=get_resolved_history&limit=5')
h_records = res_history.get('data', {}).get('records', [])
print(f'已結案歷史筆數 (前 5 筆): {len(h_records)} 筆')
if h_records:
    latest_resolved = h_records[0]
    print(f"最新已結案記錄: [{latest_resolved['deptName']}] {latest_resolved['content']}")
    print(f"  處理說明: {latest_resolved['resolution']}")
    print(f"  結案人員: {latest_resolved['resolvedBy']} (時間: {latest_resolved['resolvedAt']})")
assert res_history.get('success') == True, '取得歷史紀錄失敗'

print('\n=====================================================')
print('🎉 所有新功能端點端對端測試全部 PASS 通過！')
print('=====================================================')
