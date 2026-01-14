#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""微信群交易信息解析脚本 v2 - 精细解析版"""

import json
import os
import re
from pathlib import Path
from datetime import datetime

def clean_text(text):
    """清理文本中的emoji和特殊字符"""
    # 保留中文、英文、数字、常用标点
    text = re.sub(r'[🈶🔥⚠️💎📱🌟🍎🎫💰✈️🈲️🈲🚀⭐💥🉐👉\[發\]]+', '', text)
    return text.strip()

def extract_show_info(content):
    """提取演出名称和日期"""
    lines = content.strip().split('\n')
    show_name = ''
    current_date = ''
    
    # 常见演出名模式
    show_patterns = [
        r'(成都|深圳|广州|上海|北京|杭州|武汉|南昌|厦门|佛山|天津|郑州|三亚|香港|澳门|长沙)[\s]*(F4|刘宇宁|张杰|王力宏|陈楚生|周传雄|袁娅维|邓紫棋|张韶涵|韩红|陈慧娴|郭德纲|伍佰|何浩楠|蒲熠星|王心凌|BP|blackpink)',
        r'(香港BP|香港bp|澳门SJ)',
        r'([\u4e00-\u9fa5]{2,6})(演唱会|恒星之城)?',
    ]
    
    # 日期模式
    date_patterns = [
        r'(\d{1,2})月(\d{1,2})日?',
        r'(\d{1,2})号',
        r'1\.(\d{1,2})号?',
        r'(\d{1,2})/(\d{1,2})号?',
    ]
    
    return show_name, current_date

def parse_single_message(content, source_group):
    """解析单条消息，返回多条交易记录"""
    trades = []
    content = clean_text(content)
    lines = content.strip().split('\n')
    
    # 提取演出名
    show_name = ''
    current_date = ''
    extra_notes = []  # 统一的备注信息
    
    # 第一遍：识别演出名和全局信息
    full_text = content.lower()
    
    # 识别演出名
    show_match = re.search(
        r'(成都|深圳|广州|上海|北京|杭州|武汉|南昌|厦门|佛山|天津|郑州|三亚|香港|澳门|长沙|韩红|陈慧娴)[\s]*(F4|f4|刘宇宁|张杰|王力宏|陈楚生|周传雄|袁娅维|邓紫棋|张韶涵|韩红|陈慧娴|郭德纲|伍佰|何浩楠|蒲熠星|王心凌|BP|bp|blackpink|恒星之城)?',
        content
    )
    if show_match:
        show_name = show_match.group(0).strip()
    
    # 识别全局备注
    if '邀请函秒发' in content or '函秒发' in content:
        extra_notes.append('邀请函秒发')
    elif '秒发' in content:
        extra_notes.append('秒发')
    elif '秒录' in content:
        extra_notes.append('秒录')
    if '现票' in content:
        extra_notes.append('现票')
    
    # 识别返点
    rebate_match = re.search(r'[返反](\d+)', content)
    if rebate_match:
        extra_notes.append(f'返{rebate_match.group(1)}')
    
    # 第二遍：逐行解析票价信息
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # 更新日期
        date_match = re.search(r'(\d{1,2})月(\d{1,2})日?|(\d{1,2})号|1\.(\d{1,2})', line)
        if date_match:
            if date_match.group(1) and date_match.group(2):
                current_date = f'{date_match.group(1)}月{date_match.group(2)}日'
            elif date_match.group(3):
                current_date = f'1月{date_match.group(3)}日'
            elif date_match.group(4):
                current_date = f'1月{date_match.group(4)}日'
        
        # 解析票价行
        # 格式1: 1880的看台前10排6500 或 1880看台-6500
        # 格式2: 1580的3400 或 1580-3400
        # 格式3: 包厢1500 或 四层包厢-1350
        # 格式4: 480×2 3000 或 680×1 1100
        
        price_patterns = [
            # 1880的看台前10排6500
            (r'(\d+)的?(看台|内场|VIP|vip)?前?(\d+)?排?[\s-]*(\d{3,5})', 'standard'),
            # 1580-3400 或 1580的3400
            (r'(\d{3,4})[-的](\d{3,5})', 'simple'),
            # 包厢1500 或 四层包厢-1350
            (r'(包厢|[四五]层包厢)[-\s]*(\d{3,5})', 'box'),
            # 680×1 1100
            (r'(\d{3,4})[×x]\d+\s+(\d{3,5})', 'quantity'),
            # VIP前8排10000
            (r'(VIP|vip|内场|看台)前?(\d+)?排?[\s-]*(\d{4,5})', 'vip'),
        ]
        
        for pattern, ptype in price_patterns:
            matches = re.finditer(pattern, line)
            for m in matches:
                ticket_type = ''
                price = 0
                seat_info = ''
                
                if ptype == 'standard':
                    original_price = m.group(1)
                    area = m.group(2) or '看台'
                    row = m.group(3)
                    price = int(m.group(4))
                    ticket_type = f'{original_price}{area}'
                    if row:
                        seat_info = f'前{row}排'
                
                elif ptype == 'simple':
                    original_price = m.group(1)
                    price = int(m.group(2))
                    ticket_type = f'{original_price}看台'
                
                elif ptype == 'box':
                    ticket_type = m.group(1)
                    price = int(m.group(2))
                
                elif ptype == 'quantity':
                    original_price = m.group(1)
                    price = int(m.group(2))
                    ticket_type = f'{original_price}看台'
                
                elif ptype == 'vip':
                    area = m.group(1)
                    row = m.group(2)
                    price = int(m.group(3))
                    ticket_type = f'{area}'
                    if row:
                        seat_info = f'前{row}排'
                
                if price >= 100 and show_name:
                    title = f'{show_name}'
                    if current_date:
                        title += f' {current_date}'
                    title += f' {ticket_type}'
                    
                    extra = []
                    if seat_info:
                        extra.append(seat_info)
                    extra.extend(extra_notes)
                    
                    trades.append({
                        'title': title,
                        'price': price,
                        'extra_info': '，'.join(extra) if extra else '',
                        'trade_type': 'sell',
                        'source_group': source_group
                    })
    
    return trades

def is_trade_message(content):
    """判断是否为交易信息"""
    if not content or len(content) < 15:
        return False
    
    # 排除纯聊天
    exclude_patterns = [r'^\[图片\]$', r'^\[语音\]$', r'^@', r'^OK$', r'^好的$']
    for p in exclude_patterns:
        if re.match(p, content.strip(), re.IGNORECASE):
            return False
    
    # 必须包含价格数字
    if not re.search(r'\d{3,}', content):
        return False
    
    # 包含票务关键词
    keywords = ['出', '票', '场', '排', '座', '内场', '看台', 'VIP', '包厢', '号', '日', '秒发', '秒录', '邀请函']
    return any(k in content for k in keywords)

def main():
    wechat_dir = Path('wechat')
    all_trades = []
    
    for json_file in wechat_dir.glob('*.json'):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            group_name = data.get('session', {}).get('nickname', '未知群')
            messages = data.get('messages', [])
            
            for msg in messages:
                if msg.get('type') != '文本消息':
                    continue
                
                content = msg.get('content', '')
                if not is_trade_message(content):
                    continue
                
                trades = parse_single_message(content, group_name)
                all_trades.extend(trades)
                
        except Exception as e:
            print(f"Error processing {json_file}: {e}")
    
    # 去重
    seen = set()
    unique_trades = []
    for t in all_trades:
        key = (t['title'], t['price'])
        if key not in seen:
            seen.add(key)
            unique_trades.append(t)
    
    print(f"总共解析到 {len(all_trades)} 条交易信息")
    print(f"去重后剩余 {len(unique_trades)} 条")
    print("\n--- 前30条交易信息预览 ---")
    print(f"{'序号':<4} {'标题':<35} {'价格':<8} {'补充信息':<25}")
    print("-" * 80)
    
    for i, t in enumerate(unique_trades[:30], 1):
        title = t['title'][:33] if len(t['title']) > 33 else t['title']
        extra = t['extra_info'][:23] if len(t['extra_info']) > 23 else t['extra_info']
        print(f"{i:<4} {title:<35} ¥{t['price']:<7} {extra:<25}")
    
    # 保存结果
    with open('parsed_trades.json', 'w', encoding='utf-8') as f:
        json.dump(unique_trades, f, ensure_ascii=False, indent=2)
    
    print(f"\n结果已保存到 parsed_trades.json")
    return unique_trades

if __name__ == '__main__':
    main()
