#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""微信群交易信息解析脚本 v4 - 支持演唱会门票 + 纪念钞/纪念币"""

import json
import re
from pathlib import Path

def clean_emoji(text):
    """清理emoji"""
    return re.sub(r'[🈶🔥⚠️💎📱🌟🍎🎫💰✈️🈲️🈲🚀⭐💥🉐👉\[發\]❤️💛🧡]+', '', text)

# ==================== 纪念钞/纪念币解析 ====================

def is_coin_trade_message(content):
    """判断是否为纪念钞/纪念币交易信息"""
    # 排除非纪念币内容（会员卡、视频网站等）
    exclude_keywords = [
        '优酷', '网易云', '饿了么', '芒果', '闪购', '苏宁', '爱奇艺', 'QQ音乐',
        '腾讯视频', '哔哩哔哩', 'B站', '美团', '滴滴', '京东', '淘宝', '天猫',
        '年卡', '月卡', '季卡', '会员', 'VIP', '影城', '电影票', '小时付',
        '演唱会', '门票', '看台', '内场', '包厢', '邀请函', '秒发', '秒录',
        '配单', '剁票', '返点', '返佣'
    ]
    if any(k in content for k in exclude_keywords):
        return False
    
    # 关键词检测
    coin_keywords = [
        '马币', '马钞', '工行卡', '交行卡', '建行卡', '农行卡', '中行卡',
        '纪念钞', '纪念币', '闷包', '标百', '刀', '枚', '套',
        '驰跃宏图', '龙钞', '蛇钞', '航天钞', '冬奥钞', '亚运钞',
        '做多', '做空', '交割', '期货', '现货', '保证金',
        '银马', '金马', '彩银', '梅花马', '福字', '贺岁', '大运河',
        '永结同心', '瑞气盈门', '抗战', '智能卡', '中国龙'
    ]
    return any(k in content for k in coin_keywords)

def parse_coin_structured_data(content):
    """
    解析纪念钞/纪念币的结构化数据
    格式: 商品名称,价格,方向,交割期,备注信息
    多条记录用双空格分隔
    例如: 马币5000枚,13,多,15天期,互打1元保证金;单快递≥1000枚
    """
    trades = []
    
    # 步骤1: 按双空格分割成独立条目
    items = re.split(r'\s{2,}', content)
    
    for item in items:
        item = item.strip()
        if not item:
            continue
        
        # 步骤2: 解析每个条目 - 格式: 名称,价格,方向,交割期,备注
        m = re.match(r'^([^,]+),(\d+),([多空]),([^,]+),(.*)$', item)
        if m:
            name = m.group(1).strip()
            price = int(m.group(2))
            direction = m.group(3)  # 多 或 空
            delivery = m.group(4).strip()  # 交割期
            notes = m.group(5).strip()  # 备注
            
            # 确定交易类型
            trade_type = determine_coin_trade_type(direction, delivery)
            
            # 提取交割天数
            delivery_days = extract_delivery_days(delivery)
            
            trade = {
                'title': name,
                'price': price,
                'extra_info': notes if notes else delivery,
                'trade_type': trade_type,
                'delivery_days': delivery_days,
                'category': 'coin'  # 标记为纪念币类别
            }
            trades.append(trade)
    
    return trades

def determine_coin_trade_type(direction, delivery):
    """
    确定纪念币交易类型
    - 多 + 现货 → 求购 (buy, trade_type=1)
    - 空 + 现货 → 出售 (sell, trade_type=2)
    - 多 + 有交割期 → 做多 (long, trade_type=3)
    - 空 + 有交割期 → 做空 (short, trade_type=4)
    """
    is_spot = '现货' in delivery or '到货即交割' in delivery
    
    if direction == '多':
        return 'buy' if is_spot else 'long'
    else:  # 空
        return 'sell' if is_spot else 'short'

def extract_delivery_days(delivery):
    """提取交割天数"""
    if '现货' in delivery or '到货即交割' in delivery:
        return 0
    
    m = re.search(r'(\d+)天', delivery)
    if m:
        return int(m.group(1))
    return 0

def parse_coin_natural_language(content):
    """
    解析纪念钞/纪念币的自然语言描述
    支持多种格式:
    - 1250出5个工行卡第一批货源闷包
    - 850出工行卡闷包期货500个
    - 90收驰跃宏图原价78元的
    - 7000收150g银马原盒闷包
    - 13收马币15天期
    - 6000收交行卡闷包现货，一套5枚的
    - 33求500张散钞不挑号7天期
    
    支持全局补充信息：段落末尾的补充信息适用于整段话的所有交易
    """
    trades = []
    
    # 按行分割处理
    lines = content.replace('❗', '\n').replace('！', '\n').split('\n')
    lines = [l.strip() for l in lines if l.strip()]
    
    # 提取全局补充信息（段落末尾的非交易行）
    global_extra = extract_global_extra_info(lines)
    
    for line in lines:
        if not line or len(line) < 5:
            continue
        
        # 跳过非交易信息行（这些可能是全局补充信息）
        if is_global_info_line(line):
            continue
        
        trade = parse_single_coin_line(line, global_extra)
        if trade:
            trades.append(trade)
    
    return trades

def extract_global_extra_info(lines):
    """
    提取全局补充信息
    段落末尾的非交易行通常是全局补充信息，适用于整段话的所有交易
    """
    global_parts = []
    
    # 从后往前扫描，找到全局补充信息
    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        
        # 检测是否为全局补充信息行
        if is_global_info_line(line):
            # 提取有用的信息
            info = extract_useful_global_info(line)
            if info:
                global_parts.insert(0, info)
        else:
            # 遇到交易行就停止
            break
    
    # 也检查整个内容中的全局关键词
    full_content = '\n'.join(lines)
    
    # 死交割/定金信息
    m = re.search(r'死交割[：:]*定金[：:]*(\d+)[/／]?\s*刀', full_content)
    if m and f'死交割定金{m.group(1)}/刀' not in global_parts:
        global_parts.append(f'死交割定金{m.group(1)}/刀')
    
    # 互打/中介信息
    if '互打' in full_content and '互打' not in '；'.join(global_parts):
        if '熟人' in full_content:
            global_parts.append('熟人口头支持')
        if '中介' in full_content:
            global_parts.append('中介互打')
    
    return '；'.join(global_parts) if global_parts else ''

def is_global_info_line(line):
    """判断是否为全局补充信息行（非交易行）"""
    line = line.strip()
    
    # 全局信息关键词
    global_keywords = [
        '死交割', '定金', '互打', '中介', '熟人', '口头',
        '具体私聊', '私聊确认', '以上', '有量私聊', '标价私聊',
        '新品行情', '行情变动'
    ]
    
    # 如果包含全局关键词且不像是交易行
    if any(k in line for k in global_keywords):
        # 检查是否有价格+收/出的模式（交易行特征）
        if not re.search(r'^\d+\s*(收|出|求)', line) and not re.search(r'(收|出|求)\d+', line):
            return True
    
    return False

def extract_useful_global_info(line):
    """从全局信息行中提取有用的信息"""
    parts = []
    
    # 死交割定金
    m = re.search(r'死交割[：:]*定金[：:]*(\d+)[/／]?\s*刀', line)
    if m:
        parts.append(f'死交割定金{m.group(1)}/刀')
    
    # 互打方式
    if '熟人口头' in line:
        parts.append('熟人口头支持')
    if '中介互打' in line:
        parts.append('中介互打')
    
    return '；'.join(parts) if parts else None

def parse_single_coin_line(line, global_extra=''):
    """解析单行纪念币交易信息"""
    
    # 清理emoji和特殊字符
    line = clean_emoji(line).strip()
    if not line:
        return None
    
    # 定义商品关键词映射（用于标准化商品名称）
    # 注意：顺序很重要，更具体的关键词要放在前面
    product_keywords = {
        '150克彩银马': '150克彩银马',
        '150g银马': '150克银马',
        '150克银马': '150克银马',
        '15g圆形银马': '15克圆形银马',
        '15克银马': '15克彩银马',
        '彩银马15克': '15克彩银马',
        '公斤银马': '公斤银马',
        '彩金银马': '彩金银马',
        '金银马': '金银马',
        '彩银马': '彩银马',
        '银马': '银马',
        '梅花马金币': '梅花马金币',
        '梅花马': '梅花马',
        '工行卡龙的奇迹': '工行卡龙的奇迹',
        '龙的奇迹': '工行卡龙的奇迹',
        '工行卡': '工行卡龙的奇迹',
        '工商卡': '工行卡龙的奇迹',
        '交行卡': '交行卡',
        '交通卡': '交行卡',
        '农行卡': '农行卡',
        '建行卡': '建行卡',
        '中行卡': '中行卡',
        '马钞标百': '马钞标百',
        '标百': '马钞标百',
        '马钞散钞': '马钞散钞',
        '散钞': '马钞散钞',
        '马钞': '马钞',
        '马币': '马币',
        '驰跃宏图': '驰跃宏图',
        '中国龙智能卡': '中国龙智能卡',
        '中国龙': '中国龙智能卡',
        '2026贺岁金银': '2026贺岁金银福字',
        '贺岁金银福字': '贺岁金银福字',
        '贺岁金银': '贺岁金银福字',
        '2026贺岁银币': '2026贺岁银币福字',
        '贺岁银币福字': '贺岁银币福字',
        '贺岁银币': '贺岁银币福字',
        '福字银币': '贺岁银币福字',
        '福字金银': '贺岁金银福字',
        '80周年抗战金银': '80周年抗战金银',
        '抗战金银': '80周年抗战金银',
        '大运河银币': '大运河银币',
        '大运河': '大运河银币',
        '永结同心银币': '永结同心银币',
        '永结同心': '永结同心银币',
        '瑞气盈门银币': '瑞气盈门银币',
        '瑞气盈门': '瑞气盈门银币',
        '大黑马': '150克银马封装',
        '蛇钞': '蛇钞',
        '龙钞': '龙钞',
        '生肖大版折': '马年生肖大版折',
    }
    
    price = None
    direction = None  # 多=收/求, 空=出
    product_name = None
    quantity = ''
    delivery = '现货'
    extra_info = ''
    
    # 模式1: 价格+收/出+天期+商品名 (如: 16800收7天期标百，非001)
    m = re.match(r'^(\d+)\s*(出|收|求)\s*(\d+天期)?\s*(.+)', line)
    if m:
        price = int(m.group(1))
        direction = '空' if m.group(2) == '出' else '多'
        delivery_part = m.group(3) or ''
        rest = m.group(4).strip()
        
        # 如果匹配到天期，设置delivery
        if delivery_part:
            delivery = delivery_part
        
        # 从剩余部分提取商品名和其他信息
        product_name, detected_delivery, extra_info = extract_product_info(rest, product_keywords)
        
        # 如果前面没有匹配到天期，使用检测到的
        if not delivery_part and detected_delivery != '现货':
            delivery = detected_delivery
        elif delivery_part:
            # 确保天期在extra_info中
            if delivery_part not in extra_info:
                extra_info = f'{delivery_part}；{extra_info}' if extra_info else delivery_part
    
    # 模式2: 价格/单位+出/收+数量+商品名 (如: 1250出5个工行卡, 950/枚收工商卡)
    if not product_name:
        m = re.match(r'^(\d+)(?:/[枚套个刀张])?[元]?\s*(出|收|求)\s*(\d+)?[个枚套刀张]\s*(.+)', line)
        if m:
            price = int(m.group(1))
            direction = '空' if m.group(2) == '出' else '多'
            qty = m.group(3) or ''
            rest = m.group(4).strip()
            
            # 从剩余部分提取商品名和其他信息
            product_name, delivery, extra_info = extract_product_info(rest, product_keywords)
            # 只有当数量不是年份(如2026)、不是重量(如150g)时才添加
            if qty and int(qty) < 1000 and not re.search(r'150|15|克|g', rest[:10]):
                quantity = f'{qty}个'
    
    # 模式2: 价格+收/出+商品名+期限 (如: 13收马币15天期, 3700求5刀不挑号标百7天期)
    if not product_name:
        m = re.match(r'^(\d+(?:\.\d+)?)\s*(收|出|求)\s*(.+)', line)
        if m:
            price = int(float(m.group(1)))
            direction = '空' if m.group(2) == '出' else '多'
            rest = m.group(3).strip()
            product_name, delivery, extra_info = extract_product_info(rest, product_keywords)
    
    # 模式3: 收/出+价格范围+商品名 (如: 收150克彩银马云商封装)
    if not product_name:
        m = re.match(r'^(收|出|求)\s*(.+)', line)
        if m:
            direction = '空' if m.group(1) == '出' else '多'
            rest = m.group(2).strip()
            # 尝试从rest中提取价格
            price_m = re.search(r'(\d+)(?:~|～|-|起)?(\d+)?', rest)
            if price_m:
                price = int(price_m.group(2) or price_m.group(1))  # 取范围的高价
                rest = rest[price_m.end():].strip()
            product_name, delivery, extra_info = extract_product_info(rest, product_keywords)
    
    # 验证解析结果
    if not product_name or not price or price < 1:
        return None
    
    # 过滤无效的商品名（太短或包含无效关键词）
    invalid_keywords = ['通走', '包邮', '求点', '有量', '私聊', '加钱', '标价', '降价', '最后',
                        '优酷', '网易云', '饿了么', '芒果', '闪购', '苏宁', '爱奇艺', '腾讯',
                        '哔哩', '美团', '滴滴', '京东', '淘宝', '天猫', '年卡', '月卡', '季卡',
                        '会员', 'VIP', '影城', '电影票', '小时付', '天期34', '天期35', '.7']
    if len(product_name) < 2 or any(k in product_name for k in invalid_keywords):
        return None
    
    # 验证是否为有效的纪念币商品名
    valid_coin_keywords = ['马币', '马钞', '标百', '散钞', '工行', '交行', '建行', '农行', '中行',
                           '银马', '金马', '彩银', '梅花', '福字', '贺岁', '驰跃', '龙钞', '蛇钞',
                           '智能卡', '中国龙', '大运河', '永结同心', '瑞气盈门', '抗战', '纪念']
    if not any(k in product_name for k in valid_coin_keywords):
        return None
    
    # 确定交易类型
    trade_type = determine_coin_trade_type(direction, delivery)
    delivery_days = extract_delivery_days(delivery)
    
    # 构建标题（包含号码条件）
    title = product_name
    # 如果extra_info中有号码条件，加到标题里
    if '非001' in extra_info:
        title = f'{product_name}（非001）'
    elif '001' in extra_info and '非001' not in extra_info:
        title = f'{product_name}（001）'
    if quantity:
        title = f'{title} {quantity}'
    
    # 合并全局补充信息
    final_extra = extra_info
    if global_extra:
        if final_extra:
            final_extra = f'{final_extra}；{global_extra}'
        else:
            final_extra = global_extra
    
    return {
        'title': title,
        'price': price,
        'extra_info': final_extra if final_extra else delivery,
        'trade_type': trade_type,
        'delivery_days': delivery_days,
        'category': 'coin'
    }

def extract_product_info(text, product_keywords):
    """从文本中提取商品名称、交割期和额外信息"""
    product_name = None
    delivery = '现货'
    extra_parts = []
    
    # 检测交割期（优先检测）
    delivery_match = re.search(r'(\d+)天期', text)
    if delivery_match:
        days = delivery_match.group(1)
        delivery = f'{days}天期'
        extra_parts.append(delivery)
    elif '期货' in text:
        delivery = '期货'
        extra_parts.append('期货')
    elif '现货' in text:
        delivery = '现货'
    elif '到货' in text:
        delivery = '到货即交割'
    
    # 提取号码条件
    if '无347' in text or '无3、4、7' in text:
        extra_parts.append('无347')
    if '非001' in text:
        extra_parts.append('非001')
    elif re.search(r'[，,\s]001[，,\s]|^001[，,\s]|[，,\s]001$|[，,]001$', text):
        extra_parts.append('001')
    
    # 提取商品名称
    for keyword, standard_name in product_keywords.items():
        if keyword in text:
            product_name = standard_name
            break
    
    # 如果没有匹配到关键词，尝试提取商品描述
    if not product_name:
        # 移除数量和单位，提取核心商品名
        cleaned = re.sub(r'\d+[个枚套刀张]', '', text)
        cleaned = re.sub(r'\d+天期|期货|现货|闷包|拆包|原盒|封装|云商|无347|非001|001', '', cleaned)
        cleaned = cleaned.strip('，,、。')
        if cleaned and len(cleaned) >= 2:
            product_name = cleaned[:20]  # 限制长度
    
    # 提取其他额外信息
    if '闷包' in text:
        extra_parts.append('闷包')
    if '拆包' in text:
        extra_parts.append('拆包')
    if '原盒' in text:
        extra_parts.append('原盒')
    if '封装' in text:
        extra_parts.append('封装')
    if '云商' in text:
        extra_parts.append('云商')
    if '不挑号' in text:
        extra_parts.append('不挑号')
    if '第一批' in text:
        extra_parts.append('第一批货源')
    
    extra_info = '；'.join(extra_parts) if extra_parts else delivery
    
    return product_name, delivery, extra_info

# ==================== 演唱会门票解析（保持原有逻辑）====================

def extract_show_name(content):
    """提取演出名称"""
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

def is_ticket_trade_message(content):
    """判断是否为演唱会门票交易信息"""
    if not content or len(content) < 20:
        return False
    if re.match(r'^\[图片\]$|^\[语音\]$|^@', content.strip()):
        return False
    if not re.search(r'\d{3,}', content):
        return False
    keywords = ['出', '票', '排', '内场', '看台', 'VIP', '包厢', '秒发', '秒录', '邀请函', '录信息']
    return any(k in content for k in keywords)

def parse_ticket_lines(content, show_name):
    """解析票价信息"""
    trades = []
    lines = content.split('\n')
    
    current_date = ''
    global_notes = []
    
    if '邀请函秒发' in content or '函秒发' in content:
        global_notes.append('邀请函秒发')
    elif '秒发' in content:
        global_notes.append('秒发')
    elif '秒录' in content or '录信息' in content:
        global_notes.append('录信息')
    if '现票' in content:
        global_notes.append('现票')
    
    rebate = re.search(r'[返反统一反](\d+)', content)
    if rebate:
        global_notes.append(f'返{rebate.group(1)}')
    
    for line in lines:
        line = clean_emoji(line).strip()
        if not line:
            continue
        
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
        
        # 各种票价格式解析...
        m = re.search(r'(\d{3,4})的?(看台|内场)?前(\d+)排[\s\-]*(\d{4,5})', line)
        if m:
            ticket = f'{m.group(1)}{m.group(2) or "看台"}'
            price = int(m.group(4))
            seat = f'前{m.group(3)}排'
            trades.append(make_ticket_trade(show_name, current_date, ticket, price, seat, global_notes))
            continue
        
        m = re.search(r'^(\d{3,4})[-的](\d{3,5})$', line.replace(' ', ''))
        if m:
            orig = int(m.group(1))
            price = int(m.group(2))
            if orig < price or (orig > 300 and price > 300):
                ticket = f'{orig}看台'
                trades.append(make_ticket_trade(show_name, current_date, ticket, price, '', global_notes))
                continue
        
        m = re.search(r'(\d{3,4})?(VIP|vip|内场)前?(\d+)?排?[\s\-]*(\d{4,5})', line)
        if m:
            orig = m.group(1) or ''
            area = m.group(2)
            row = m.group(3)
            price = int(m.group(4))
            ticket = f'{orig}{area}' if orig else area
            seat = f'前{row}排' if row else ''
            trades.append(make_ticket_trade(show_name, current_date, ticket, price, seat, global_notes))
            continue
        
        m = re.search(r'([四五]层)?包厢[\s\-]*(\d{3,5})', line)
        if m:
            box_type = m.group(1) or ''
            ticket = f'{box_type}包厢'
            price = int(m.group(2))
            trades.append(make_ticket_trade(show_name, current_date, ticket, price, '', global_notes))
            continue
        
        m = re.search(r'(\d{3,4})[×x\*](\d+)\s+(\d{3,5})', line, re.IGNORECASE)
        if m:
            orig = m.group(1)
            qty = m.group(2)
            price = int(m.group(3))
            ticket = f'{orig}看台'
            seat = f'×{qty}'
            trades.append(make_ticket_trade(show_name, current_date, ticket, price, seat, global_notes))
            continue
        
        m = re.search(r'(看台|内场)(\d{3,4})[-\s]*(\d{3,5})', line)
        if m:
            area = m.group(1)
            orig = m.group(2)
            price = int(m.group(3))
            ticket = f'{orig}{area}'
            trades.append(make_ticket_trade(show_name, current_date, ticket, price, '', global_notes))
            continue
        
        m = re.search(r'(\d{3,4})[-\s]*(\d{3,5})[（\(]([^）\)]+)[）\)]', line)
        if m:
            orig = m.group(1)
            price = int(m.group(2))
            seat = m.group(3)
            ticket = f'{orig}看台'
            trades.append(make_ticket_trade(show_name, current_date, ticket, price, seat, global_notes))
            continue
        
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
            trades.append(make_ticket_trade(show_name, current_date, ticket, price, seat, global_notes))
            continue
        
        m = re.search(r'(舞台两侧|两侧)[\s\-]*(\d{3,5})', line)
        if m:
            ticket = '舞台两侧'
            price = int(m.group(2))
            trades.append(make_ticket_trade(show_name, current_date, ticket, price, '', global_notes))
            continue
    
    return trades

def make_ticket_trade(show_name, date, ticket, price, seat, notes):
    """构建演唱会门票交易记录"""
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
        'trade_type': 'sell',  # 演唱会门票默认为出售
        'delivery_days': 0,
        'category': 'ticket'
    }

# ==================== 主程序 ====================

def get_trade_type_code(trade_type):
    """获取交易类型代码"""
    mapping = {
        'buy': 1,    # 求购
        'sell': 2,   # 出售
        'long': 3,   # 做多
        'short': 4,  # 做空
    }
    return mapping.get(trade_type, 2)

def get_trade_type_name(trade_type):
    """获取交易类型名称"""
    mapping = {
        'buy': '求购',
        'sell': '出售',
        'long': '做多',
        'short': '做空',
    }
    return mapping.get(trade_type, '出售')

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
                
                # 提取发送者信息（微信ID和昵称）
                sender_wxid = msg.get('senderUsername', '')
                sender_name = msg.get('senderDisplayName', '')
                
                # 过滤掉群聊系统消息（wxid以@chatroom结尾的是群消息）
                if sender_wxid.endswith('@chatroom'):
                    continue
                
                # 优先检测纪念币交易
                if is_coin_trade_message(content):
                    # 先尝试解析结构化数据
                    trades = parse_coin_structured_data(content)
                    if not trades:
                        # 再尝试解析自然语言
                        trades = parse_coin_natural_language(content)
                    
                    for t in trades:
                        t['source_group'] = group_name
                        t['sender_wxid'] = sender_wxid  # 微信ID
                        t['sender_name'] = sender_name  # 昵称
                    all_trades.extend(trades)
                    continue
                
                # 演唱会门票解析
                if is_ticket_trade_message(content):
                    show_name = extract_show_name(content)
                    if not show_name:
                        continue
                    
                    trades = parse_ticket_lines(content, show_name)
                    for t in trades:
                        t['source_group'] = group_name
                        t['sender_wxid'] = sender_wxid  # 微信ID
                        t['sender_name'] = sender_name  # 昵称
                    all_trades.extend(trades)
                
        except Exception as e:
            print(f"Error: {json_file.name}: {e}")
    
    # 去重：同标题+同交易类型保留最优价格
    dedup = {}
    for t in all_trades:
        key = f"{t['title']}_{t['trade_type']}"
        if key not in dedup:
            dedup[key] = t
        else:
            # 求购/做多取最高价，出售/做空取最低价
            if t['trade_type'] in ['buy', 'long']:
                if t['price'] > dedup[key]['price']:
                    dedup[key] = t
            else:
                if t['price'] < dedup[key]['price']:
                    dedup[key] = t
    
    result = list(dedup.values())
    result.sort(key=lambda x: (x['category'], x['title']))
    
    print(f"总共解析: {len(all_trades)} 条")
    print(f"去重后: {len(result)} 条")
    
    # 分类统计
    tickets = [t for t in result if t.get('category') == 'ticket']
    coins = [t for t in result if t.get('category') == 'coin']
    print(f"  - 演唱会门票: {len(tickets)} 条")
    print(f"  - 纪念钞/币: {len(coins)} 条")
    
    # 统计有微信ID的记录
    with_wxid = [t for t in result if t.get('sender_wxid') and not t.get('sender_wxid', '').endswith('@chatroom')]
    print(f"  - 带微信ID: {len(with_wxid)} 条")
    
    print("\n" + "="*130)
    print(f"{'序号':<4} | {'类型':<6} | {'标题':<30} | {'价格':<8} | {'交易':<4} | {'发布者':<15} | {'微信ID':<25}")
    print("="*130)
    
    for i, t in enumerate(result[:50], 1):
        title = t['title'][:28] if len(t['title']) > 28 else t['title']
        cat = '门票' if t.get('category') == 'ticket' else '纪念币'
        trade_name = get_trade_type_name(t['trade_type'])
        sender = t.get('sender_name', '')[:13] if t.get('sender_name') else ''
        wxid = t.get('sender_wxid', '')[:23] if t.get('sender_wxid') else ''
        print(f"{i:<4} | {cat:<6} | {title:<30} | ¥{t['price']:<7} | {trade_name:<4} | {sender:<15} | {wxid}")
    
    with open('parsed_trades.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n结果已保存到 parsed_trades.json")

if __name__ == '__main__':
    main()
