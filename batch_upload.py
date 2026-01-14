#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""批量上传交易数据到Supabase - 生成分批SQL"""

import json
from datetime import datetime, timedelta

# 读取解析数据
with open('parsed_trades.json', 'r', encoding='utf-8') as f:
    trades = json.load(f)

admin_user_id = '33f25311-64d7-4b2a-b000-491a44112d29'
expire_at = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S')

# 生成每批SQL
batch_size = 20
batches = []

for i in range(0, len(trades), batch_size):
    batch = trades[i:i+batch_size]
    values = []
    for t in batch:
        title = t['title'].replace("'", "''")
        keywords = title
        price = t['price']
        trade_type = 1 if t['trade_type'] == 'sell' else 2
        extra_info = (t.get('extra_info', '') or '').replace("'", "''")
        
        values.append(
            f"('{admin_user_id}', '{title}', '{keywords}', {price}, {trade_type}, "
            f"'{extra_info}', 10, 0, 0, 1, '{expire_at}')"
        )
    
    sql = "INSERT INTO posts (user_id, title, keywords, price, trade_type, extra_info, view_limit, view_count, deal_count, status, expire_at) VALUES\n"
    sql += ",\n".join(values)
    batches.append(sql)

# 保存为JSON供后续使用
with open('batch_sqls.json', 'w', encoding='utf-8') as f:
    json.dump(batches, f, ensure_ascii=False)

print(f"共 {len(trades)} 条数据，分 {len(batches)} 批")
print(f"已保存到 batch_sqls.json")
