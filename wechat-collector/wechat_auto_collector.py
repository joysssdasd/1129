"""
微信群消息自动采集工具 - WeChatFerry版
实时监控微信群消息，自动解析并发布到交易平台

使用方法：
1. 确保微信已登录
2. 以管理员身份运行: python wechat_auto_collector.py
3. 程序会自动注入微信并开始监控
"""

import json
import time
import hashlib
import threading
import re
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
from queue import Queue

# 日志配置
from loguru import logger
log_dir = Path(__file__).parent / "logs"
log_dir.mkdir(exist_ok=True)
logger.add(
    str(log_dir / "wechat_collector_{time:YYYY-MM-DD}.log"),
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
        hashes = list(self.hashes)[-5000:]  # 只保留最近5000条
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
                timeout=30.0
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


class WeChatAutoCollector:
    """微信自动采集器 - 基于WeChatFerry"""
    
    def __init__(self, config_path: str = "config.json"):
        self.config = Config(config_path)
        self.cache = MessageCache()
        self.message_queue = Queue()
        self.running = False
        
        # 初始化组件
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
        
        # 监控的群列表
        self.monitor_groups = set(self.config.get('monitor_groups', []))
        self.group_id_map = {}  # 群名 -> 群ID 映射
        
        # 过滤配置
        self.keywords = self.config.get('filter.keywords', ['出', '收', '转', '票'])
        self.min_len = self.config.get('filter.min_message_length', 10)
        self.max_len = self.config.get('filter.max_message_length', 2000)
        
        # 处理间隔
        self.interval = self.config.get('schedule.interval_minutes', 60) * 60
        
    def is_trade_message(self, content: str) -> bool:
        """判断是否是交易消息"""
        if len(content) < self.min_len or len(content) > self.max_len:
            return False
        return any(kw in content for kw in self.keywords)
        
    def on_message(self, msg):
        """消息回调"""
        try:
            # 只处理群文本消息
            if not msg.from_group():
                return
            if msg.type != 1:  # 1=文本消息
                return
                
            content = msg.content
            room_id = msg.roomid
            sender = msg.sender
            
            # 检查是否是监控的群
            group_name = self.group_id_map.get(room_id, '')
            if self.monitor_groups and group_name not in self.monitor_groups:
                # 如果没有映射，尝试匹配
                if room_id not in self.group_id_map:
                    return
                    
            # 检查是否是交易消息
            if not self.is_trade_message(content):
                return
                
            # 检查是否已处理
            if self.cache.is_processed(content):
                return
                
            logger.info(f"[{group_name or room_id}] 收到交易消息: {content[:50]}...")
            self.message_queue.put({
                'content': content,
                'room_id': room_id,
                'sender': sender,
                'time': datetime.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"处理消息出错: {e}")
            
    def process_messages(self):
        """处理队列中的消息"""
        messages = []
        while not self.message_queue.empty():
            try:
                messages.append(self.message_queue.get_nowait())
            except:
                break
                
        if not messages:
            return
            
        logger.info(f"开始处理 {len(messages)} 条消息")
        
        all_items = []
        for msg in messages:
            content = msg['content']
            items = self.parser.parse(content)
            all_items.extend(items)
            self.cache.mark_processed(content)
            
        if all_items:
            logger.info(f"解析出 {len(all_items)} 条交易信息，开始发布...")
            result = self.publisher.publish(all_items)
            logger.info(f"发布结果: 成功 {result.get('success', 0)}/{result.get('total', 0)}")
        else:
            logger.info("未解析出交易信息")
            
        self.cache.save()
        
    def run(self):
        """运行采集器"""
        from wcferry import Wcf
        
        logger.info("=" * 60)
        logger.info("微信群消息自动采集工具 - WeChatFerry版")
        logger.info("=" * 60)
        logger.info(f"监控群: {self.monitor_groups or '全部群'}")
        logger.info(f"处理间隔: {self.interval // 60} 分钟")
        logger.info(f"关键词: {self.keywords}")
        logger.info("=" * 60)
        
        wcf = Wcf()
        
        try:
            # 获取群列表并建立映射
            contacts = wcf.get_contacts()
            for c in contacts:
                if c.get('wxid', '').endswith('@chatroom'):
                    name = c.get('name', '') or c.get('remark', '')
                    self.group_id_map[c['wxid']] = name
                    if name in self.monitor_groups:
                        logger.info(f"已匹配群: {name} -> {c['wxid']}")
                        
            logger.info(f"共发现 {len(self.group_id_map)} 个群")
            
            # 启用消息接收
            wcf.enable_receiving_msg()
            self.running = True
            
            logger.info("开始监控消息，按 Ctrl+C 停止...")
            
            last_process = time.time()
            
            while self.running:
                # 获取新消息
                msg = wcf.get_msg()
                if msg:
                    self.on_message(msg)
                    
                # 定时处理
                if time.time() - last_process >= self.interval:
                    self.process_messages()
                    last_process = time.time()
                    
                time.sleep(0.5)
                
        except KeyboardInterrupt:
            logger.info("收到停止信号...")
        except Exception as e:
            logger.error(f"运行出错: {e}")
            import traceback
            logger.error(traceback.format_exc())
        finally:
            self.running = False
            self.process_messages()  # 处理剩余消息
            self.cache.save()
            wcf.cleanup()
            logger.info("采集器已停止")


def main():
    import argparse
    parser = argparse.ArgumentParser(description='微信群消息自动采集工具')
    parser.add_argument('--config', '-c', default='config.json', help='配置文件')
    parser.add_argument('--interval', '-i', type=int, help='处理间隔(分钟)')
    parser.add_argument('--list-groups', action='store_true', help='列出所有群')
    args = parser.parse_args()
    
    if args.list_groups:
        from wcferry import Wcf
        wcf = Wcf()
        contacts = wcf.get_contacts()
        print("\n所有群列表:")
        for c in contacts:
            if c.get('wxid', '').endswith('@chatroom'):
                print(f"  - {c.get('name', '未知')} ({c['wxid']})")
        wcf.cleanup()
        return
        
    collector = WeChatAutoCollector(args.config)
    if args.interval:
        collector.interval = args.interval * 60
    collector.run()


if __name__ == '__main__':
    main()
