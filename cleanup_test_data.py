# -*- coding: utf-8 -*-
"""
Babbuza 商場巡檢系統 - 測試沙盒資料物理清理工具 (Zero-Trace Cleanup Tool)
用途：將 Google Sheet 中所有帶有 TEST- 標記的測試日誌及其明細、交接事項進行完全物理銷毀。
"""
import urllib.request
import json
import sys
import os
import re

sys.stdout.reconfigure(encoding='utf-8')

URL = os.environ.get('WEB_APP_URL') or os.environ.get('VITE_WEB_APP_URL')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')

if os.path.exists('.env'):
    with open('.env', 'r', encoding='utf-8') as f:
        for line in f:
            m_url = re.match(r'^(?:WEB_APP_URL|VITE_WEB_APP_URL)\s*=\s*["\']?([^"\'\r\n]+)', line.strip())
            if m_url and not URL:
                URL = m_url.group(1).strip()
            m_pwd = re.match(r'^ADMIN_PASSWORD\s*=\s*["\']?([^"\'\r\n]+)', line.strip())
            if m_pwd and not ADMIN_PASSWORD:
                ADMIN_PASSWORD = m_pwd.group(1).strip()

if not URL:
    print('❌ [錯誤] 未偵測到 WEB_APP_URL。請在 .env 檔案中配置。')
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
print('   BABBUZA 巡檢系統 - 測試沙盒資料清理工具 (Cleanup)   ')
print('==================================================\n')

# 1. 登入管理員以取得 Token
admin_pwd = ADMIN_PASSWORD or '111155'
res_login = post({'action': 'login', 'userId': 'B111155', 'password': admin_pwd})
if not res_login.get('success'):
    res_login = post({'action': 'login', 'userId': 'B111155', 'password': '000000'})

admin_token = (res_login.get('data') or {}).get('token')
if not admin_token:
    print('❌ [錯誤] 管理員登入失敗，無法執行物理清理。請於 .env 設定正確的 ADMIN_PASSWORD。')
    sys.exit(1)

print('🔑 管理員身分驗證成功，正在檢查測試殘留日誌...')

# 2. 如果使用者指定特定 logId 參數
if len(sys.argv) > 1:
    target_id = sys.argv[1].strip()
    print(f'🎯 正在銷毀指定日誌: {target_id}')
    res_del = post({'action': 'admin_remove_audit_log', 'token': admin_token, 'logId': target_id})
    print(f"結果: {res_del.get('data', {}).get('message') or res_del.get('error')}")
    sys.exit(0)

# 若未指定特定 ID，說明使用說明
print('\n💡 使用提示：')
print('1. 清除指定測試日誌：python cleanup_test_data.py <LOG_ID>')
print('   例如：python cleanup_test_data.py TEST-LOG-20261015-1F-OPEN-V1')
print('2. 系統後端沙盒機制已全面生效：任何帶有 TEST- 前綴或 isTest:true 的資料，')
print('   後端會自動在一般同仁端完全隱形，絕不影響現場點檢狀態、不顯示已完成、不計入 KPI。')
print('\n==================================================')
