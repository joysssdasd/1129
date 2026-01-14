#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""通过Supabase REST API批量上传数据"""

import json
import requests
from datetime import datetime, timedelta

# Supabase配置
SUPABASE_URL = "https://hntiihuxqlklpiyqmlob.supabase.co"
# 需要从Supabase获取service_role key
SUPABASE_KEY = None  # 需要填入

def upload_via_rest():
    """通过REST API上传"""
    if not SUPABASE_KEY:
        print("需要配置SUPABASE_KEY")
        return
    
    with open('parsed_trades.json', 'r', encoding='utf-8') as f:
        trades = json.load(f)
    
    admin_user_id = '33f25311-64d7-4b2a-b000-491a44112d29'
    expire_at = (datetime.now() + timedelta(days=30)).isoformat()
    
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    }
    
    # 准备数据
    records = []
    for t in trades:
        records.append({
            'user_id': admin_user_id,
            'title': t['title'],
            'keywords': t['title'],
            'price': t['price'],
            'trade_type': 1 if t['trade_type'] == 'sell' else 2,
            'extra_info': t.get('extra_info', ''),
            'view_limit': 10,
            'view_count': 0,
            'deal_count': 0,
            'status': 1,
            'expire_at': expire_at
        })
    
    # 分批上传
    batch_size = 50
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        response = requests.post(
            f'{SUPABASE_URL}/rest/v1/posts',
            headers=headers,
            json=batch
        )
        if response.status_code in [200, 201]:
            print(f"批次 {i//batch_size + 1} 上传成功: {len(batch)} 条")
        else:
            print(f"批次 {i//batch_size + 1} 失败: {response.status_code} - {response.text}")

if __name__ == '__main__':
    # 输出统计
    with open('parsed_trades.json', 'r', encoding='utf-8') as f:
        trades = json.load(f)
    print(f"待上传: {len(trades)} 条")
    print("需要配置SUPABASE_KEY后运行")
