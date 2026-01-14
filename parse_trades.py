#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""微信群交易信息解析脚本"""

import json
import os
import re
from pathlib import Path

def is_trade_message(content):
    """判断是否为交易信息"""
    if not content or len(content) < 10:
        return False
    
    # 排除纯聊天
    exclude_patterns = [r'^OK$', r'^好的$', r'^收到$', r'^谢谢', r'^\[图片\]$', r'^\[语音\]$', r'^@']
    for p in exclude_patterns:
        if re.match(p, content.strip(), re.IGNORECASE):
            return False
    
    # 必须包含3位以上数字
    if not re.search(r'\d{3,}', content):
        return False
    
    # 包含票务关键词
    keywords = ['出', '收', '票', '场', '排', '座', '内场', '看台', 'VIP', '包厢', '号', '日', '月', '演唱会']
    return any(k in content for k in keywords)

def get_trade_type(content):
    """判断交易类型"""
    buy_keywords = ['求', '需要', '收', '回收', '最高价', '高价收', '急收', '长期收']
    # 如果以"出"开头，肯定是出售
    if content.strip().startswith('出'):
        return 'sell'
    for k in buy_keywords:
        if k in content:
            return 'buy'
    return 'sell'

def extract_title(content):
    """提取标题"""
    lines = [l.strip() for l in content.split('\n') if l.strip()]
    if not lines:
        return '未知演出'
    
    first_line = lines[0]
    # 清理前缀
    first_line = re.sub(r'^[出收【】\[\]]', '', first_line)
    # 清理emoji
    first_line = re.sub(r'[🈶🔥⚠️💎📱🌟🍎🎫💰✈️🈲️🈲🚀⭐]+', '', first_line)
    first_line = first_line.strip()
    
    return first_line[:40] if first_line else '未知演出'

def parse_prices(content):
    """解析价格"""
    prices = []
    
    # 格式: 680-1900, 680的1900, 出1900, 售1900
    patterns = [
        r'(\d+)[-的](\d+)',  # 680-1900
        r'[出售](\d{3,5})',  # 出1900
        r'(\d{3,5})[x×]\d+\s+(\d{3,5})',  # 680x1 1900
    ]
    
    for p in patterns:
        for m in re.finditer(p, content):
            price = int(m.group(m.lastindex))
            if 100 <= price <= 50000:
                prices.append(price)
    
    # 如果没找到，尝试找所有3-5位数字
    if not prices:
        for m in re.finditer(r'\b(\d{3,5})\b', content):
            price = int(m.group(1))
            if 100 <= price <= 50000:
                prices.append(price)
    
    return prices

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
                
                title = extract_title(content)
                trade_type = get_trade_type(content)
                prices = parse_prices(content)
                
                if prices:
                    # 出售取最低价，求购取最高价
                    if trade_type == 'buy':
                        price = max(prices)
                    else:
                        valid_prices = [p for p in prices if p > 500] or prices
                        price = min(valid_prices) if valid_prices else prices[0]
                    
                    all_trades.append({
                        'title': title,
                        'price': price,
                        'extra_info': content[:300],
                        'trade_type': trade_type,
                        'source_group': group_name
                    })
        except Exception as e:
            print(f"Error processing {json_file}: {e}")
    
    # 去重：同标题出售保留最低价，求购保留最高价
    deduped = {}
    for t in all_trades:
        key = (t['title'], t['trade_type'])
        if key not in deduped:
            deduped[key] = t
        else:
            if t['trade_type'] == 'sell' and t['price'] < deduped[key]['price']:
                deduped[key] = t
            elif t['trade_type'] == 'buy' and t['price'] > deduped[key]['price']:
                deduped[key] = t
    
    final_trades = list(deduped.values())
    
    print(f"总共解析到 {len(all_trades)} 条交易信息")
    print(f"去重后剩余 {len(final_trades)} 条")
    print("\n--- 前20条交易信息预览 ---")
    
    for i, t in enumerate(final_trades[:20], 1):
        type_str = '出售' if t['trade_type'] == 'sell' else '求购'
        print(f"{i}. [{type_str}] {t['title']} | ¥{t['price']} | 来源: {t['source_group'][:15]}")
    
    # 保存结果
    with open('parsed_trades.json', 'w', encoding='utf-8') as f:
        json.dump(final_trades, f, ensure_ascii=False, indent=2)
    
    print(f"\n结果已保存到 parsed_trades.json")
    return final_trades

if __name__ == '__main__':
    main()
