# -*- coding: utf-8 -*-
import urllib.request
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('.env', 'r', encoding='utf-8') as f:
    env = dict(line.strip().split('=', 1) for line in f if '=' in line and not line.startswith('#'))

url = env['WEB_APP_URL']

# 1. 1F
req1 = urllib.request.urlopen(f'{url}?action=get_handover&deptId=1F&onlyOpen=true')
res1 = json.loads(req1.read().decode('utf-8'))
notes1 = res1.get('data', {}).get('notes', [])
print(f'=== 1F 服務台首頁即時備忘 (共 {len(notes1)} 則，未結案才顯示) ===')
for n in notes1:
    print(f" • [{n.get('type')}] {n.get('content')}")

# 2. 全商場
req2 = urllib.request.urlopen(f'{url}?action=get_open_issues')
res2 = json.loads(req2.read().decode('utf-8'))
issues = res2.get('data', {}).get('issues', [])
print(f'\n=== 全商場未結案異常集中追蹤 (共 {len(issues)} 則，跨站點集中管轄) ===')
for i in issues:
    print(f" • [{i.get('deptName')}] [{i.get('type')}] {i.get('content')} (待處理 {i.get('pendingDays')} 天)")

# 3. 已結案
req3 = urllib.request.urlopen(f'{url}?action=get_resolved_history')
res3 = json.loads(req3.read().decode('utf-8'))
resolved = res3.get('data', {}).get('records', [])
print(f'\n=== 已結案歷史紀錄 (共 {len(resolved)} 則，全員皆可查閱) ===')
for r in resolved:
    print(f" • [{r.get('deptName')}] {r.get('content')}\n   ↳ 處理說明: {r.get('resolution')} | 核銷人: {r.get('resolvedBy')}")
