#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""上传解析后的交易信息到 Supabase"""

import json

# 交易类型映射
TRADE_TYPE_MAP = {
    'buy': 1,    # 求购
    'sell': 2,   # 出售
    'long': 3,   # 做多
    'short': 4,  # 做空
}

# 管理员用户ID
ADMIN_USER_ID = '33f25311-64d7-4b2a-b000-491a44112d29'

def escape_sql_string(s):
    """转义SQL字符串中的特殊字符"""
    if not s:
        return ''
    return s.replace("'", "''")

def generate_sql_inserts(trades):
    """生成SQL INSERT语句"""
    values = []
    
    for t in trades:
        title = escape_sql_string(t['title'])
        keywords = escape_sql_string(t['title'])  # 使用标题作为关键词
        price = t['price']
        trade_type = TRADE_TYPE_MAP.get(t['trade_type'], 2)
        extra_info = escape_sql_string(t['extra_info'])
        
        value = f"('{ADMIN_USER_ID}', '{title}', '{keywords}', {price}, {trade_type}, '{extra_info}', 10, 0, 0, 1, NOW() + INTERVAL '3 days')"
        values.append(value)
    
    return values

def main():
    # 读取解析结果
    with open('parsed_trades.json', 'r', encoding='utf-8') as f:
        trades = json.load(f)
    
    print(f"总共 {len(trades)} 条记录")
    
    # 分类统计
    coins = [t for t in trades if t.get('category') == 'coin']
    tickets = [t for t in trades if t.get('category') == 'ticket']
    print(f"  - 纪念钞/币: {len(coins)} 条")
    print(f"  - 演唱会门票: {len(tickets)} 条")
    
    # 生成SQL
    values = generate_sql_inserts(trades)
    
    # 分批生成SQL（每批50条）
    batch_size = 50
    for i in range(0, len(values), batch_size):
        batch = values[i:i+batch_size]
        sql = f"""INSERT INTO posts (user_id, title, keywords, price, trade_type, extra_info, view_limit, view_count, deal_count, status, expire_at) VALUES
{',\n'.join(batch)};"""
        
        print(f"\n--- 批次 {i//batch_size + 1} ({len(batch)} 条) ---")
        print(sql[:500] + "..." if len(sql) > 500 else sql)
    
    # 保存完整SQL到文件
    all_sql = f"""-- 自动生成的交易信息插入SQL
-- 总共 {len(trades)} 条记录
-- 生成时间: 2026-01-13

INSERT INTO posts (user_id, title, keywords, price, trade_type, extra_info, view_limit, view_count, deal_count, status, expire_at) VALUES
{',\n'.join(values)};
"""
    
    with open('insert_trades.sql', 'w', encoding='utf-8') as f:
        f.write(all_sql)
    
    print(f"\n完整SQL已保存到 insert_trades.sql")

if __name__ == '__main__':
    main()
