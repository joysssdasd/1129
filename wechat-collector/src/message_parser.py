"""
消息解析模块
使用AI解析交易信息，提取结构化数据
"""

import re
import json
import httpx
from typing import List, Dict, Optional, Any
from loguru import logger


class MessageParser:
    """交易信息解析器"""
    
    def __init__(self, api_key: str, model: str = "deepseek-chat"):
        """
        初始化解析器
        
        Args:
            api_key: DeepSeek API密钥
            model: 使用的模型
        """
        self.api_key = api_key
        self.model = model
        self.api_url = "https://api.deepseek.com/chat/completions"
        
    def filter_trade_messages(self, messages: List[Dict], 
                               keywords: List[str],
                               min_length: int = 10,
                               max_length: int = 2000) -> List[Dict]:
        """
        过滤出可能是交易信息的消息
        
        Args:
            messages: 原始消息列表
            keywords: 关键词列表
            min_length: 最小消息长度
            max_length: 最大消息长度
            
        Returns:
            过滤后的消息列表
        """
        filtered = []
        
        for msg in messages:
            content = msg.get('content', '')
            
            # 长度过滤
            if len(content) < min_length or len(content) > max_length:
                continue
                
            # 关键词过滤
            has_keyword = any(kw in content for kw in keywords)
            if not has_keyword:
                continue
                
            # 排除系统消息
            if content.startswith('[') and content.endswith(']'):
                continue
                
            filtered.append(msg)
            
        logger.info(f"过滤后剩余 {len(filtered)} 条交易相关消息")
        return filtered
        
    def parse_with_ai(self, text: str) -> List[Dict]:
        """
        使用AI解析交易信息
        
        Args:
            text: 要解析的文本
            
        Returns:
            解析后的交易信息列表
        """
        prompt = f"""解析以下交易信息，提取所有商品/票务信息，返回JSON数组。

文本：
{text}

解析规则：
1. 白银交易："19/克"表示每克19元，总价=单价×克数
2. 演唱会票："1080-3000"表示1080档票售价3000元
3. trade_type: 2=出售(默认), 1=求购(含"收""求"字)

返回格式示例：
[{{"title": "王力宏绍兴3号1080", "price": 3000, "keywords": ["王力宏","演唱会"], "trade_type": 2, "description": "余1张"}}]

只返回JSON数组，无法解析返回[]："""

        try:
            response = httpx.post(
                self.api_url,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {self.api_key}'
                },
                json={
                    'model': self.model,
                    'messages': [
                        {'role': 'system', 'content': '你是交易信息解析助手，擅长从混乱文本中提取商品信息。只输出JSON数组。'},
                        {'role': 'user', 'content': prompt}
                    ],
                    'temperature': 0.1
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                logger.error(f"AI API错误: {response.text}")
                return []
                
            result = response.json()
            content = result.get('choices', [{}])[0].get('message', {}).get('content', '[]')
            
            logger.debug(f"AI返回: {content}")
            
            # 提取JSON数组
            json_match = re.search(r'\[[\s\S]*\]', content)
            if json_match:
                parsed = json.loads(json_match.group())
                if isinstance(parsed, list):
                    return parsed
                    
            return []
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析错误: {e}")
            return []
        except Exception as e:
            logger.error(f"AI解析失败: {e}")
            return []

    def parse_messages(self, messages: List[Dict]) -> List[Dict]:
        """
        批量解析消息
        
        Args:
            messages: 消息列表
            
        Returns:
            解析后的交易信息列表
        """
        all_items = []
        
        # 合并消息文本，减少API调用次数
        batch_size = 5
        for i in range(0, len(messages), batch_size):
            batch = messages[i:i + batch_size]
            combined_text = "\n---\n".join([m.get('content', '') for m in batch])
            
            items = self.parse_with_ai(combined_text)
            all_items.extend(items)
            
            logger.info(f"解析批次 {i//batch_size + 1}，得到 {len(items)} 条交易信息")
            
        return all_items


class SimpleParser:
    """简单规则解析器（不依赖AI）"""
    
    # 演唱会票务模式
    TICKET_PATTERNS = [
        # 格式：票档-价格
        r'(\d+)-(\d+)',
        # 格式：票档的价格
        r'(\d+)的(\d+)',
        # 格式：包厢/看台等
        r'(包厢|看台|内场|前排)[^\d]*(\d+)',
    ]
    
    # 白银交易模式
    SILVER_PATTERNS = [
        # 格式：xx/克
        r'(\d+(?:\.\d+)?)/克',
        # 格式：xx克
        r'(\d+)克',
    ]
    
    def parse_ticket_info(self, text: str) -> List[Dict]:
        """解析演唱会票务信息"""
        items = []
        
        # 提取演出名称（通常在第一行）
        lines = text.strip().split('\n')
        if not lines:
            return items
            
        # 尝试提取城市+歌手名
        first_line = lines[0]
        show_name = re.sub(r'[\d\-\(\)（）余加]', '', first_line).strip()[:20]
        
        # 解析票档价格
        for pattern in self.TICKET_PATTERNS:
            matches = re.findall(pattern, text)
            for match in matches:
                if len(match) >= 2:
                    ticket_type = match[0]
                    price = int(match[1])
                    
                    items.append({
                        'title': f"{show_name}{ticket_type}",
                        'price': price,
                        'keywords': [show_name, '演唱会', '门票'],
                        'trade_type': 2,
                        'description': text[:100]
                    })
                    
        return items
        
    def parse_silver_info(self, text: str) -> List[Dict]:
        """解析白银交易信息"""
        items = []
        
        # 提取克价
        price_match = re.search(r'(\d+(?:\.\d+)?)/克', text)
        if not price_match:
            return items
            
        price_per_gram = float(price_match.group(1))
        
        # 提取克数
        weight_match = re.search(r'(\d+)克', text)
        weight = int(weight_match.group(1)) if weight_match else 1000
        
        # 提取纯度
        purity_match = re.search(r'(\d{3})', text)
        purity = purity_match.group(1) if purity_match else '999'
        
        # 判断买卖方向
        trade_type = 2 if '出' in text or '卖' in text else 1
        
        items.append({
            'title': f"白银{purity}银条{weight}克",
            'price': int(price_per_gram * weight),
            'keywords': ['白银', '银条', purity],
            'trade_type': trade_type,
            'description': text[:200]
        })
        
        return items
        
    def parse(self, text: str) -> List[Dict]:
        """
        自动识别并解析交易信息
        
        Args:
            text: 原始文本
            
        Returns:
            解析后的交易信息列表
        """
        items = []
        
        # 判断类型并解析
        if '银' in text or '/克' in text:
            items.extend(self.parse_silver_info(text))
        elif any(kw in text for kw in ['演唱会', '门票', '看台', '内场', '包厢']):
            items.extend(self.parse_ticket_info(text))
        else:
            # 尝试票务解析
            items.extend(self.parse_ticket_info(text))
            
        return items
