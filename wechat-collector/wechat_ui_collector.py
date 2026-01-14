"""
微信群消息自动采集工具 - UI自动化版
通过 Windows UI 自动化读取微信消息

使用方法：
1. 打开微信并登录
2. 运行: python wechat_ui_collector.py
"""

import json
import time
import hashlib
import re
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
import uiautomation as auto

from loguru import logger

# 配置日志
log_dir = Path(__file__).parent / "logs"
log_dir.mkdir(exist_ok=True)
logger.add(
    str(log_dir / "ui_collector_{time:YYYY-MM-DD}.log"),
    rotation="1 day",
    retention="7 days",
    level="INFO",
    encoding="utf-8"
)


class Config:
    """配置管理"""
    def __init__(self, config_path: str = "config.json"):
        self.path = Path(__file__).parent / config_path
        self.data = self._load()
        
    def _load(self) -> dict:
        if self.path.exists():
            with open(self.path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    def get(self, key: str, default=None):
        keys = key.split('.')
        val = self.data
        for k in keys:
            if isinstance(val, dict):
                val = val.get(k, default)
            else:
                return default
        return val


class MessageCache:
    """消息去重缓存"""
    def __init__(self):
        self.cache_file = Path(__file__).parent / "processed_messages.json"
        self.hashes = set()
        self._load()
        
    def _load(self):
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r') as f:
                    self.hashes = set(json.load(f).get('hashes', []))
            except:
                pass
                
    def save(self):
        hashes = list(self.hashes)[-5000:]
        with open(self.cache_file, 'w') as f:
            json.dump({'hashes': hashes}, f)
            
    def is_processed(self, text: str) -> bool:
        h = hashlib.md5(text.encode()).hexdigest()[:16]
        return h in self.hashes
        
    def mark_processed(self, text: str):
        h = hashlib.md5(text.encode()).hexdigest()[:16]
        self.hashes.add(h)


class AIParser:
    """AI解析器"""
    def __init__(self, api_key: str, model: str = "deepseek-chat"):
        self.api_key = api_key
        self.model = model
        self.api_url = "https://api.deepseek.com/chat/completions"
        
    def parse(self, text: str) -> List[Dict]:
        import httpx
        
        prompt = f"""解析以下交易信息，提取商品/票务信息，返回JSON数组。

文本：
{text}

规则：
1. 演唱会票："1080-3000"或"1080的3000"表示1080档票售价3000
2. trade_type: 2=出售(默认), 1=求购(含"收""求"字)
3. 提取微信号到wechat_id字段

返回格式：[{{"title":"标题","price":数字,"keywords":["关键词"],"trade_type":2,"description":"描述","wechat_id":"微信号或空"}}]
只返回JSON数组："""

        try:
            resp = httpx.post(
                self.api_url,
                headers={'Authorization': f'Bearer {self.api_key}', 'Content-Type': 'application/json'},
                json={
                    'model': self.model,
                    'messages': [
                        {'role': 'system', 'content': '你是交易信息解析助手，只输出JSON数组。'},
                        {'role': 'user', 'content': prompt}
                    ],
                    'temperature': 0.1
                },
                timeout=60.0
            )
            
            if resp.status_code == 200:
                content = resp.json().get('choices', [{}])[0].get('message', {}).get('content', '[]')
                match = re.search(r'\[[\s\S]*\]', content)
                if match:
                    return json.loads(match.group())
            return []
        except Exception as e:
            logger.error(f"AI解析失败: {e}")
            return []


class Publisher:
    """发布器"""
    def __init__(self, supabase_url: str, supabase_key: str, user_id: str, default_wechat: str):
        self.url = supabase_url.rstrip('/')
        self.key = supabase_key
        self.user_id = user_id
        self.default_wechat = default_wechat
        
    def publish(self, items: List[Dict]) -> Dict:
        import httpx
        
        if not items:
            return {'success': 0, 'total': 0}
            
        drafts = []
        for item in items:
            kw = item.get('keywords', [])
            if isinstance(kw, list):
                kw = ','.join(kw)
            drafts.append({
                'title': item.get('title', ''),
                'price': float(item.get('price', 0)),
                'keywords': kw,
                'trade_type': item.get('trade_type', 2),
                'description': item.get('description', ''),
                'user_id': self.user_id,
                'wechat_id': item.get('wechat_id') or self.default_wechat
            })
            
        try:
            resp = httpx.post(
                f"{self.url}/functions/v1/ai-batch-publish-v2",
                headers={'Authorization': f'Bearer {self.key}', 'Content-Type': 'application/json'},
                json={'user_id': self.user_id, 'step': 'publish', 'drafts': drafts},
                timeout=60.0
            )
            if resp.status_code == 200:
                data = resp.json().get('data', {})
                return {'success': data.get('success_count', 0), 'total': len(items)}
            return {'success': 0, 'total': len(items), 'error': resp.text}
        except Exception as e:
            logger.error(f"发布失败: {e}")
            return {'success': 0, 'total': len(items), 'error': str(e)}


class WeChatUIReader:
    """通过UI自动化读取微信消息"""
    
    def __init__(self):
        self.wechat_window = None
        
    def find_wechat(self) -> bool:
        """查找微信窗口"""
        try:
            self.wechat_window = auto.WindowControl(searchDepth=1, ClassName='WeChatMainWndForPC')
            if self.wechat_window.Exists(maxSearchSeconds=3):
                logger.info("找到微信窗口")
                return True
            logger.error("未找到微信窗口")
            return False
        except Exception as e:
            logger.error(f"查找微信窗口失败: {e}")
            return False
            
    def get_chat_list(self) -> List[str]:
        """获取会话列表"""
        if not self.wechat_window:
            return []
        try:
            chat_list = self.wechat_window.ListControl(Name='会话')
            items = chat_list.GetChildren()
            return [item.Name for item in items if item.Name]
        except:
            return []
            
    def click_chat(self, chat_name: str) -> bool:
        """点击指定会话"""
        if not self.wechat_window:
            return False
        try:
            chat_list = self.wechat_window.ListControl(Name='会话')
            for item in chat_list.GetChildren():
                if chat_name in item.Name:
                    item.Click()
                    time.sleep(0.5)
                    return True
            return False
        except Exception as e:
            logger.error(f"点击会话失败: {e}")
            return False
            
    def get_messages(self, count: int = 20) -> List[str]:
        """获取当前会话的消息"""
        if not self.wechat_window:
            return []
        try:
            msg_list = self.wechat_window.ListControl(Name='消息')
            if not msg_list.Exists(maxSearchSeconds=2):
                return []
            messages = []
            items = msg_list.GetChildren()
            for item in items[-count:]:
                try:
                    text = item.Name or ''
                    if text:
                        messages.append(text)
                except:
                    pass
            return messages
        except Exception as e:
            logger.error(f"获取消息失败: {e}")
            return []


class WeChatUICollector:
    """微信UI自动采集器"""
    
    def __init__(self, config_path: str = "config.json"):
        self.config = Config(config_path)
        self.cache = MessageCache()
        self.reader = WeChatUIReader()
        
        self.parser = AIParser(
            api_key=self.config.get('ai.deepseek_api_key', ''),
            model=self.config.get('ai.model', 'deepseek-chat')
        )
        self.publisher = Publisher(
            supabase_url=self.config.get('platform.supabase_url', ''),
            supabase_key=self.config.get('platform.supabase_anon_key', ''),
            user_id=self.config.get('platform.user_id', ''),
            default_wechat=self.config.get('platform.default_wechat_id', 'niuniubase')
        )
        
        self.monitor_groups = self.config.get('monitor_groups', [])
        self.keywords = self.config.get('filter.keywords', ['出', '收', '转', '票'])
        self.min_len = self.config.get('filter.min_message_length', 10)
        self.max_len = self.config.get('filter.max_message_length', 2000)
        self.interval = self.config.get('schedule.interval_minutes', 60) * 60
        
    def is_trade_message(self, content: str) -> bool:
        if len(content) < self.min_len or len(content) > self.max_len:
            return False
        return any(kw in content for kw in self.keywords)
        
    def collect_from_group(self, group_name: str) -> List[str]:
        """从指定群采集消息"""
        if not self.reader.click_chat(group_name):
            logger.warning(f"无法打开群: {group_name}")
            return []
        time.sleep(1)
        messages = self.reader.get_messages(50)
        trade_msgs = []
        for msg in messages:
            if self.is_trade_message(msg) and not self.cache.is_processed(msg):
                trade_msgs.append(msg)
                logger.info(f"[{group_name}] 发现交易消息: {msg[:50]}...")
        return trade_msgs
        
    def process_and_publish(self, messages: List[str]):
        """处理并发布消息"""
        if not messages:
            return
        logger.info(f"开始处理 {len(messages)} 条消息")
        all_items = []
        for msg in messages:
            items = self.parser.parse(msg)
            all_items.extend(items)
            self.cache.mark_processed(msg)
        if all_items:
            logger.info(f"解析出 {len(all_items)} 条交易信息")
            result = self.publisher.publish(all_items)
            logger.info(f"发布结果: 成功 {result.get('success', 0)}/{result.get('total', 0)}")
        self.cache.save()
        
    def run(self):
        """运行采集器"""
        logger.info("=" * 60)
        logger.info("微信群消息自动采集工具 - UI自动化版")
        logger.info("=" * 60)
        logger.info(f"监控群: {self.monitor_groups}")
        logger.info(f"处理间隔: {self.interval // 60} 分钟")
        logger.info("=" * 60)
        
        if not self.reader.find_wechat():
            logger.error("请先打开微信!")
            return
            
        logger.info("开始监控，按 Ctrl+C 停止...")
        
        try:
            while True:
                all_messages = []
                for group in self.monitor_groups:
                    msgs = self.collect_from_group(group)
                    all_messages.extend(msgs)
                    time.sleep(2)
                    
                if all_messages:
                    self.process_and_publish(all_messages)
                    
                logger.info(f"等待 {self.interval // 60} 分钟后再次采集...")
                time.sleep(self.interval)
                
        except KeyboardInterrupt:
            logger.info("采集器已停止")
            self.cache.save()


def main():
    import argparse
    parser = argparse.ArgumentParser(description='微信群消息自动采集工具')
    parser.add_argument('--config', '-c', default='config.json', help='配置文件')
    parser.add_argument('--interval', '-i', type=int, help='处理间隔(分钟)')
    parser.add_argument('--list-chats', action='store_true', help='列出会话')
    args = parser.parse_args()
    
    if args.list_chats:
        import sys
        sys.stdout.reconfigure(encoding='utf-8')
        reader = WeChatUIReader()
        if reader.find_wechat():
            chats = reader.get_chat_list()
            print("\n会话列表:")
            for c in chats[:20]:
                print(f"  - {c}")
        return
        
    collector = WeChatUICollector(args.config)
    if args.interval:
        collector.interval = args.interval * 60
    collector.run()


if __name__ == '__main__':
    main()
