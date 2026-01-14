#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""微信群交易信息解析脚本 v3 - 更精确的解析"""

import json
import re
from pathlib import Path

def clean_emoji(text):
    """清理emoji"""
    return re.sub(r'[🈶🔥⚠️💎📱🌟🍎🎫💰✈️🈲️🈲🚀⭐💥🉐👉\[發\]❤️]+', '', text)

def extract_show_name(content):
    """提取演出名称"""
    # 城市+艺人名
    patterns = [
        r'(成都|深圳|广州|上海|北京|杭州|武汉|南昌|厦门|佛山|天津|郑州|三亚|长沙|海口|泉州|福州)(F4|f4|刘宇宁|张杰|王力宏|陈楚生|周传雄|袁娅维|邓紫棋|张韶涵|韩红|陈慧娴|郭德纲|伍佰|何浩楠|蒲熠星|王心凌|华晨宇|任贤齐|杨丞琳|陈柏宇|姜育恒|汪苏泷|陈嘉桦|王赫野|谢霆锋|孙燕姿)',
        r'(香港|澳门)(BP|bp|blackpink|SJ|sj|张学友|孙燕姿|汪苏泷)',
        r'(韩红)(杭州|武汉|深圳|上海)',
        r'(陈慧娴)(武汉|深圳|上海|广州)',
    ]
    
    for p in patterns:
        m = re.search(p, content, re.IGNORECASE)
        if m:
            return m.group(0)
    
    # 特殊格式
    special = [
        (r'你好星期六', '你好星期六'),
        (r'湖南卫视.*?晚会', '湖南卫视晚会'),
        (r'上海F1', '上海F1'),
        (r'德云社.*?封箱', '德云社封箱'),
    ]
    for p, name in special:
        if re.search(p, content):
            return name
    
    return None

def parse_ticket_lines(content, show_name):
    """解析票价信息，返回交易列表"""
    trades = []
    lines = content.split('\n')
    
    current_date = ''
    global_notes = []
    
    # 提取全局备注
    if '邀请函秒发' in content or '函秒发' in content:
        global_notes.append('邀请函秒发')
    elif '秒发' in content:
        global_notes.append('秒发')
    elif '秒录' in content or '录信息' in content:
        global_notes.append('录信息')
    if '现票' in content:
        global_notes.append('现票')
    
    # 返点
    rebate = re.search(r'[返反统一反](\d+)', content)
    if rebate:
        global_notes.append(f'返{rebate.group(1)}')
    
    for line in lines:
        line = clean_emoji(line).strip()
        if not line:
            continue
        
        # 更新日期 - 多种格式
        # 1月10日, 10号, 1.10, 01.10/11/12
        date_m = re.search(r'(\d{1,2})月(\d{1,2})日?', line)
        if date_m:
            current_date = f'{date_m.group(1)}月{date_m.group(2)}日'
        else:
            date_m = re.search(r'^(\d{1,2})号', line)
            if date_m:
                current_date = f'1月{date_m.group(1)}日'
            else:
                date_m = re.search(r'1\.(\d{1,2})号?', line)
                if date_m:
                    current_date = f'1月{date_m.group(1)}日'
        
        # 解析票价 - 多种格式
        
        # 格式1: 1880的看台前10排6500 或 1880看台前10排-6500
        m = re.search(r'(\d{3,4})的?(看台|内场)?前(\d+)排[\s\-]*(\d{4,5})', line)
        if m:
            ticket = f'{m.group(1)}{m.group(2) or "看台"}'
            price = int(m.group(4))
            seat = f'前{m.group(3)}排'
            trades.append(make_trade(show_name, current_date, ticket, price, seat, global_notes))
            continue
        
        # 格式2: 1580的3400 或 1580-3400 (原价-售价)
        m = re.search(r'^(\d{3,4})[-的](\d{3,5})$', line.replace(' ', ''))
        if m:
            orig = int(m.group(1))
            price = int(m.group(2))
            if orig < price or (orig > 300 and price > 300):  # 确保是原价-售价格式
                ticket = f'{orig}看台'
                trades.append(make_trade(show_name, current_date, ticket, price, '', global_notes))
                continue
        
        # 格式3: 1880VIP前8排10000
        m = re.search(r'(\d{3,4})?(VIP|vip|内场)前?(\d+)?排?[\s\-]*(\d{4,5})', line)
        if m:
            orig = m.group(1) or ''
            area = m.group(2)
            row = m.group(3)
            price = int(m.group(4))
            ticket = f'{orig}{area}' if orig else area
            seat = f'前{row}排' if row else ''
            trades.append(make_trade(show_name, current_date, ticket, price, seat, global_notes))
            continue
        
        # 格式4: 包厢1500 或 四层包厢-1350 或 五层包厢1300
        m = re.search(r'([四五]层)?包厢[\s\-]*(\d{3,5})', line)
        if m:
            box_type = m.group(1) or ''
            ticket = f'{box_type}包厢'
            price = int(m.group(2))
            trades.append(make_trade(show_name, current_date, ticket, price, '', global_notes))
            continue
        
        # 格式5: 680×1 1100 或 980*2 1500
        m = re.search(r'(\d{3,4})[×x\*](\d+)\s+(\d{3,5})', line, re.IGNORECASE)
        if m:
            orig = m.group(1)
            qty = m.group(2)
            price = int(m.group(3))
            ticket = f'{orig}看台'
            seat = f'×{qty}'
            trades.append(make_trade(show_name, current_date, ticket, price, seat, global_notes))
            continue
        
        # 格式6: 看台680-2200 或 内场1280-2800
        m = re.search(r'(看台|内场)(\d{3,4})[-\s]*(\d{3,5})', line)
        if m:
            area = m.group(1)
            orig = m.group(2)
            price = int(m.group(3))
            ticket = f'{orig}{area}'
            trades.append(make_trade(show_name, current_date, ticket, price, '', global_notes))
            continue
        
        # 格式7: 580-1200（区域信息）
        m = re.search(r'(\d{3,4})[-\s]*(\d{3,5})[（\(]([^）\)]+)[）\)]', line)
        if m:
            orig = m.group(1)
            price = int(m.group(2))
            seat = m.group(3)
            ticket = f'{orig}看台'
            trades.append(make_trade(show_name, current_date, ticket, price, seat, global_notes))
            continue
        
        # 格式8: 1280前10排*2 2500
        m = re.search(r'(\d{3,4})前(\d+)排[\*×x]?(\d+)?\s+(\d{3,5})', line)
        if m:
            orig = m.group(1)
            row = m.group(2)
            qty = m.group(3) or ''
            price = int(m.group(4))
            ticket = f'{orig}看台'
            seat = f'前{row}排'
            if qty:
                seat += f'×{qty}'
            trades.append(make_trade(show_name, current_date, ticket, price, seat, global_notes))
            continue
        
        # 格式9: 舞台两侧800
        m = re.search(r'(舞台两侧|两侧)[\s\-]*(\d{3,5})', line)
        if m:
            ticket = '舞台两侧'
            price = int(m.group(2))
            trades.append(make_trade(show_name, current_date, ticket, price, '', global_notes))
            continue
    
    return trades

def make_trade(show_name, date, ticket, price, seat, notes):
    """构建交易记录"""
    title = show_name
    if date:
        title += f' {date}'
    title += f' {ticket}'
    
    extra = []
    if seat:
        extra.append(seat)
    extra.extend(notes)
    
    return {
        'title': title,
        'price': price,
        'extra_info': '，'.join(extra),
        'trade_type': 'sell',
    }

def is_trade_message(content):
    """判断是否为交易信息"""
    if not content or len(content) < 20:
        return False
    if re.match(r'^\[图片\]$|^\[语音\]$|^@', content.strip()):
        return False
    if not re.search(r'\d{3,}', content):
        return False
    keywords = ['出', '票', '排', '内场', '看台', 'VIP', '包厢', '秒发', '秒录', '邀请函', '录信息']
    return any(k in content for k in keywords)

def main():
    wechat_dir = Path('wechat')
    all_trades = []
    
    for json_file in wechat_dir.glob('*.json'):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            group_name = data.get('session', {}).get('nickname', '未知群')
            
            for msg in data.get('messages', []):
                if msg.get('type') != '文本消息':
                    continue
                
                content = msg.get('content', '')
                if not is_trade_message(content):
                    continue
                
                show_name = extract_show_name(content)
                if not show_name:
                    continue
                
                trades = parse_ticket_lines(content, show_name)
                for t in trades:
                    t['source_group'] = group_name
                all_trades.extend(trades)
                
        except Exception as e:
            print(f"Error: {json_file.name}: {e}")
    
    # 去重：同标题保留最低价
    dedup = {}
    for t in all_trades:
        key = t['title']
        if key not in dedup or t['price'] < dedup[key]['price']:
            dedup[key] = t
    
    result = list(dedup.values())
    result.sort(key=lambda x: x['title'])
    
    print(f"总共解析: {len(all_trades)} 条")
    print(f"去重后: {len(result)} 条")
    print("\n" + "="*90)
    print(f"{'序号':<4} | {'标题':<40} | {'价格':<7} | {'补充信息':<25}")
    print("="*90)
    
    for i, t in enumerate(result[:50], 1):
        title = t['title'][:38] if len(t['title']) > 38 else t['title']
        extra = t['extra_info'][:23] if len(t['extra_info']) > 23 else t['extra_info']
        print(f"{i:<4} | {title:<40} | ¥{t['price']:<6} | {extra}")
    
    with open('parsed_trades.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n结果已保存到 parsed_trades.json")

if __name__ == '__main__':
    main()
