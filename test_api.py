# -*- coding: utf-8 -*-
import urllib.request
import json
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

# 自本地 .env 讀取 WEB_APP_URL，絕不寫死在程式碼中
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
    print('錯誤：找不到本地 .env 中的 WEB_APP_URL 設定，請先建立 .env 檔案')
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

print('=== 1. 測試 GET status ===')
res = get('action=status')
print(json.dumps(res, ensure_ascii=False, indent=2))

print('\n=== 2. 測試 離職人員阻擋登入 (離職範例帳號 A110999) ===')
res_disabled = post({'action': 'login', 'userId': 'A110999', 'password': 'dummy_password'})
print(json.dumps(res_disabled, ensure_ascii=False, indent=2))

print('\n=== 3. 測試 員工登入防線校驗 (未授權密碼阻絕) ===')
res_login = post({'action': 'login', 'userId': 'B110001', 'password': 'wrong_password_test'})
print('登入結果:', res_login.get('success'))
print('防護訊息:', res_login.get('error'))

# 模擬具備 Token 時的後續端點測試
token = os.environ.get('TEST_TOKEN')
if token:
    print('\n=== 4. 測試 取得授權站點 ===')
    res_depts = get(f'action=get_user_depts&token={token}')
    depts = res_depts.get('data', {}).get('departments', [])
    for d in depts:
        print(f" - {d['deptId']} ({d['deptName']}) 類型:{d['deptType']} 營業前截止:{d['openDeadline']}")

    print('\n=== 5. 測試 取得 1F 營業前點檢項目清單 (OPEN) ===')
    res_items = get('action=get_checklist&deptId=1F&stage=OPEN')
    items = res_items.get('data', {}).get('items', [])
    print(f"取得 1F 營業前項目共 {len(items)} 項，前 5 項：")
    for it in items[:5]:
        print(f" [{it['itemId']}] [{it['category']}] {it['title']} ({it['frequency']})")

    print('\n=== 8. 測試 送出點檢 (submit_audit) 含異常標記與 LINE 通報字串產出 ===')
    mock_payload = {
        'deptId': '1F',
        'stage': 'OPEN',
        'bizDate': '2026-10-12',
        'clientKey': 'test-key-' + str(int(__import__('time').time())),
        'items': [
            {'itemId': 'ITM-0001', 'category': 'AG2', 'title': '新光-開啟', 'status': 'OK', 'value': '', 'remark': ''},
            {'itemId': 'ITM-0002', 'category': 'AG2', 'title': '聯邦-開啟', 'status': 'OK', 'value': '', 'remark': ''},
            {'itemId': 'ITM-0003', 'category': 'POS', 'title': '開機確認結帳日期正確', 'status': 'NG', 'value': '', 'remark': 'POS機開機畫面閃爍，已通報資訊'}
        ],
        'handoverNote': '今日 14:00 有貴賓導覽團需協助引導'
    }
    res_submit = post({
        'action': 'submit_audit',
        'token': token,
        'payload': mock_payload
    })
    print("送出結果:", res_submit.get('success'))
    if res_submit.get('success'):
        data = res_submit.get('data', {})
        print("產出 Log_ID:", data.get('logId'))
        print("統計:", data.get('stats'))
        print("\n產生的 LINE 通報訊息：\n------------------------\n" + data.get('notifyReport', '') + "------------------------")

    print('\n=== 9. 測試 讀取站點交接與未結案異常 (get_handover) ===')
    res_handover = get('action=get_handover&deptId=1F')
    notes = res_handover.get('data', {}).get('notes', [])
    print(f"1F 站點交接備忘共 {len(notes)} 筆，最新備忘：")
    for n in notes[:2]:
        print(f" [{n['noteId']}] 類型:{n['type']} 狀態:{n['status']} 內容:{n['content']}")
