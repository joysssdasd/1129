"""
微信群消息自动采集 - 增强版
支持多种消息获取方式：
1. 解密数据库读取
2. 剪贴板监控（手动复制消息）
3. 文件监控（从导出的聊天记录读取）

使用方法：
python auto_collect_enhanced.py --mode clipboard  # 剪贴板模式
python auto_collect_enhanced.py --mode file --watch-dir ./messages  # 文件监控模式
python auto_collect_enhanced.py --mode db  # 数据库模式（需要密钥）
"""

import os
import sys
import json
import time
import hashlib
import argparse
import threading
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
from loguru import logger

# 配置日志
log_dir = Path(__file__).parent / "logs"
log_dir.mkdir(exist_ok=True)
logger.add(
    str(log_dir / "auto_collect_{time:YYYY-MM-DD}.log"),
    rotation="1 day",
    retention="7 days",
    level="INFO",
    encoding="utf-8"
)


class ConfigManager:
    """配置管理器"""
    
    def __init__(self, config_path: str = "config.json"):
        self.config_path = Path(__file__).parent / config_path
        self.config = self.load()
        
    def load(self) -> dict:
        if self.config_path.exists():
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
        
    def save(self):
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, ensure_ascii=False, indent=2)
            
    def get(self, key: str, default=None):
        keys = key.split('.')
        value = self.config
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k, default)
            else:
                return default
        return value


class MessageCache:
    """消息缓存，用于去重"""
    
    def __init__(self, cache_file: str = "message_cache.json"):
        self.cache_path = Path(__file__).parent / cache_file
        self.processed_hashes = set()
        self.load()
        
    def load(self):
        if self.cache_path.exists():
            try:
                with open(self.cache_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.processed_hashes = set(data.get('hashes', []))
            except:
                pass
                
    def save(self):
        with open(self.cache_path, 'w', encoding='utf-8') as f:
            # 只保留最近的10000条
            hashes = list(self.processed_hashes)[-10000:]
            json.dump({'hashes': hashes}, f)
            
    def get_hash(self, text: str) -> str:
        return hashlib.md5(text.encode()).hexdigest()[:16]
        
    def is_processed(self, text: str) -> bool:
        return self.get_hash(text) in self.processed_hashes
        
    def mark_processed(self, text: str):
        self.processed_hashes.add(self.get_hash(text))


class AIParser:
    """AI解析器 - 使用DeepSeek"""
    
    def __init__(self, api_key: str, model: str = "deepseek-chat"):
        self.api_key = api_key
        self.model = model
        self.api_url = "https://api.deepseek.com/chat/completions"
        
    def parse(self, text: str) -> List[Dict]:
        """解析交易信息"""
        import httpx
        import re
        
        prompt = f"""解析以下交易信息，提取所有商品/票务信息，返回JSON数组。

文本：
{text}

解析规则：
1. 白银交易："19/克"表示每克19元
2. 演唱会票："1080-3000"或"1080的3000"表示1080档票售价3000元
3. trade_type: 2=出售(默认), 1=求购(含"收""求"字)
4. 如果文本中有微信号，提取到wechat_id字段

返回格式：
[{{"title": "标题", "price": 价格数字, "keywords": ["关键词"], "trade_type": 2, "description": "描述", "wechat_id": "微信号或空"}}]

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
                        {'role': 'system', 'content': '你是交易信息解析助手。只输出JSON数组，不要其他内容。'},
                        {'role': 'user', 'content': prompt}
                    ],
                    'temperature': 0.1
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                logger.error(f"AI API错误: {response.status_code}")
                return []
                
            result = response.json()
            content = result.get('choices', [{}])[0].get('message', {}).get('content', '[]')
            
            # 提取JSON
            json_match = re.search(r'\[[\s\S]*\]', content)
            if json_match:
                parsed = json.loads(json_match.group())
                if isinstance(parsed, list):
                    logger.info(f"AI解析出 {len(parsed)} 条交易信息")
                    return parsed
                    
            return []
            
        except Exception as e:
            logger.error(f"AI解析失败: {e}")
            return []


class Publisher:
    """发布器 - 调用Edge Function"""
    
    def __init__(self, supabase_url: str, supabase_key: str, user_id: str, default_wechat_id: str = "niuniubase"):
        self.supabase_url = supabase_url.rstrip('/')
        self.supabase_key = supabase_key
        self.user_id = user_id
        self.default_wechat_id = default_wechat_id
        
    def publish(self, items: List[Dict]) -> Dict:
        """发布交易信息"""
        import httpx
        
        if not items:
            return {'success': 0, 'total': 0}
            
        drafts = []
        for item in items:
            keywords = item.get('keywords', [])
            if isinstance(keywords, list):
                keywords = ','.join(keywords)
                
            drafts.append({
                'title': item.get('title', ''),
                'price': float(item.get('price', 0)),
                'keywords': keywords,
                'trade_type': item.get('trade_type', 2),
                'description': item.get('description', ''),
                'user_id': self.user_id,
                'wechat_id': item.get('wechat_id') or self.default_wechat_id
            })
            
        try:
            response = httpx.post(
                f"{self.supabase_url}/functions/v1/ai-batch-publish-v2",
                headers={
                    'Authorization': f'Bearer {self.supabase_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'user_id': self.user_id,
                    'step': 'publish',
                    'drafts': drafts
                },
                timeout=60.0
            )
            
            if response.status_code == 200:
                result = response.json()
                data = result.get('data', {})
                success_count = data.get('success_count', 0)
                logger.info(f"发布成功: {success_count}/{len(items)}")
                return {
                    'success': success_count,
                    'total': len(items),
                    'errors': data.get('errors', [])
                }
            else:
                logger.error(f"发布失败: {response.text}")
                return {'success': 0, 'total': len(items), 'error': response.text}
                
        except Exception as e:
            logger.error(f"发布异常: {e}")
            return {'success': 0, 'total': len(items), 'error': str(e)}


class ClipboardCollector:
    """剪贴板监控采集器"""
    
    def __init__(self, config: ConfigManager, parser: AIParser, publisher: Publisher, cache: MessageCache):
        self.config = config
        self.parser = parser
        self.publisher = publisher
        self.cache = cache
        self.last_clipboard = ""
        self.pending_messages = []
        self.lock = threading.Lock()
        
    def get_clipboard(self) -> str:
        """获取剪贴板内容"""
        try:
            import pyperclip
            return pyperclip.paste()
        except ImportError:
            # Windows fallback
            try:
                import subprocess
                result = subprocess.run(['powershell', '-command', 'Get-Clipboard'], 
                                       capture_output=True, text=True, encoding='utf-8')
                return result.stdout.strip()
            except:
                return ""
                
    def is_trade_message(self, text: str) -> bool:
        """判断是否是交易消息"""
        keywords = self.config.get('filter.keywords', ['出', '收', '转', '票'])
        min_len = self.config.get('filter.min_message_length', 10)
        max_len = self.config.get('filter.max_message_length', 2000)
        
        if len(text) < min_len or len(text) > max_len:
            return False
            
        return any(kw in text for kw in keywords)
        
    def process_pending(self):
        """处理待发布消息"""
        with self.lock:
            if not self.pending_messages:
                return
            messages = self.pending_messages.copy()
            self.pending_messages.clear()
            
        logger.info(f"处理 {len(messages)} 条待发布消息")
        
        all_items = []
        for msg in messages:
            items = self.parser.parse(msg)
            all_items.extend(items)
            self.cache.mark_processed(msg)
            
        if all_items:
            result = self.publisher.publish(all_items)
            logger.info(f"发布结果: {result}")
            
        self.cache.save()
        
    def run(self, interval_minutes: int = 60):
        """运行剪贴板监控"""
        logger.info("=" * 50)
        logger.info("剪贴板监控模式已启动")
        logger.info(f"每 {interval_minutes} 分钟处理一次待发布消息")
        logger.info("复制交易信息到剪贴板即可自动采集")
        logger.info("按 Ctrl+C 停止")
        logger.info("=" * 50)
        
        last_process_time = time.time()
        interval_seconds = interval_minutes * 60
        
        try:
            while True:
                # 检查剪贴板
                current = self.get_clipboard()
                
                if current and current != self.last_clipboard:
                    self.last_clipboard = current
                    
                    # 检查是否是交易消息
                    if self.is_trade_message(current) and not self.cache.is_processed(current):
                        logger.info(f"检测到新交易消息: {current[:50]}...")
                        with self.lock:
                            self.pending_messages.append(current)
                            
                # 检查是否到处理时间
                if time.time() - last_process_time >= interval_seconds:
                    self.process_pending()
                    last_process_time = time.time()
                    
                time.sleep(1)  # 每秒检查一次剪贴板
                
        except KeyboardInterrupt:
            logger.info("正在停止...")
            self.process_pending()  # 处理剩余消息
            self.cache.save()


class FileWatchCollector:
    """文件监控采集器 - 监控指定目录的txt文件"""
    
    def __init__(self, config: ConfigManager, parser: AIParser, publisher: Publisher, 
                 cache: MessageCache, watch_dir: str):
        self.config = config
        self.parser = parser
        self.publisher = publisher
        self.cache = cache
        self.watch_dir = Path(watch_dir)
        self.watch_dir.mkdir(parents=True, exist_ok=True)
        self.processed_files = set()
        
    def scan_files(self) -> List[str]:
        """扫描目录中的新文件"""
        messages = []
        
        for txt_file in self.watch_dir.glob("*.txt"):
            if str(txt_file) in self.processed_files:
                continue
                
            try:
                content = txt_file.read_text(encoding='utf-8')
                if content.strip():
                    messages.append(content)
                    self.processed_files.add(str(txt_file))
                    logger.info(f"读取文件: {txt_file.name}")
            except Exception as e:
                logger.error(f"读取文件失败 {txt_file}: {e}")
                
        return messages
        
    def run(self, interval_minutes: int = 60):
        """运行文件监控"""
        logger.info("=" * 50)
        logger.info("文件监控模式已启动")
        logger.info(f"监控目录: {self.watch_dir}")
        logger.info(f"每 {interval_minutes} 分钟扫描一次")
        logger.info("将交易信息保存为txt文件到监控目录即可")
        logger.info("按 Ctrl+C 停止")
        logger.info("=" * 50)
        
        interval_seconds = interval_minutes * 60
        
        try:
            while True:
                # 扫描新文件
                messages = self.scan_files()
                
                if messages:
                    logger.info(f"发现 {len(messages)} 个新文件")
                    
                    all_items = []
                    for msg in messages:
                        if not self.cache.is_processed(msg):
                            items = self.parser.parse(msg)
                            all_items.extend(items)
                            self.cache.mark_processed(msg)
                            
                    if all_items:
                        result = self.publisher.publish(all_items)
                        logger.info(f"发布结果: {result}")
                        
                    self.cache.save()
                    
                time.sleep(interval_seconds)
                
        except KeyboardInterrupt:
            logger.info("文件监控已停止")
            self.cache.save()


def main():
    parser = argparse.ArgumentParser(description='微信群消息自动采集工具 - 增强版')
    parser.add_argument('--mode', '-m', choices=['clipboard', 'file', 'db'], 
                       default='clipboard', help='采集模式')
    parser.add_argument('--config', '-c', default='config.json', help='配置文件')
    parser.add_argument('--interval', '-i', type=int, default=60, help='处理间隔(分钟)')
    parser.add_argument('--watch-dir', '-w', default='./messages', help='文件监控目录')
    parser.add_argument('--once', '-o', action='store_true', help='只执行一次')
    
    args = parser.parse_args()
    
    # 加载配置
    config = ConfigManager(args.config)
    cache = MessageCache()
    
    # 初始化AI解析器
    ai_key = config.get('ai.deepseek_api_key', '')
    if not ai_key:
        logger.error("请在config.json中配置 ai.deepseek_api_key")
        sys.exit(1)
        
    ai_parser = AIParser(ai_key, config.get('ai.model', 'deepseek-chat'))
    
    # 初始化发布器
    publisher = Publisher(
        supabase_url=config.get('platform.supabase_url', ''),
        supabase_key=config.get('platform.supabase_anon_key', ''),
        user_id=config.get('platform.user_id', ''),
        default_wechat_id=config.get('platform.default_wechat_id', 'niuniubase')
    )
    
    # 根据模式运行
    if args.mode == 'clipboard':
        collector = ClipboardCollector(config, ai_parser, publisher, cache)
        if args.once:
            collector.process_pending()
        else:
            collector.run(args.interval)
            
    elif args.mode == 'file':
        collector = FileWatchCollector(config, ai_parser, publisher, cache, args.watch_dir)
        collector.run(args.interval)
        
    elif args.mode == 'db':
        # 数据库模式需要解密密钥
        logger.info("数据库模式需要先运行 setup_and_decrypt.py 获取密钥")
        logger.info("或使用 main.py 运行原版采集器")


if __name__ == '__main__':
    main()
