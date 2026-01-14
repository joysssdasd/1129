"""
消息去重模块
避免重复处理和发布相同的消息
"""

import json
import hashlib
from pathlib import Path
from typing import List, Dict, Set
from datetime import datetime, timedelta
from loguru import logger


class MessageDeduplicator:
    """消息去重器"""
    
    def __init__(self, cache_file: str = "./processed_messages.json"):
        """
        初始化去重器
        
        Args:
            cache_file: 缓存文件路径
        """
        self.cache_file = Path(cache_file)
        self.processed: Dict[str, str] = {}  # hash -> timestamp
        self.load_cache()
        
    def load_cache(self):
        """加载缓存"""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    self.processed = json.load(f)
                logger.info(f"加载了 {len(self.processed)} 条已处理消息记录")
            except Exception as e:
                logger.warning(f"加载缓存失败: {e}")
                self.processed = {}
                
    def save_cache(self):
        """保存缓存"""
        try:
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(self.processed, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存缓存失败: {e}")
            
    def get_hash(self, content: str) -> str:
        """计算消息哈希"""
        return hashlib.md5(content.encode('utf-8')).hexdigest()
        
    def is_processed(self, content: str) -> bool:
        """检查消息是否已处理"""
        msg_hash = self.get_hash(content)
        return msg_hash in self.processed
        
    def mark_processed(self, content: str):
        """标记消息为已处理"""
        msg_hash = self.get_hash(content)
        self.processed[msg_hash] = datetime.now().isoformat()
        
    def filter_new_messages(self, messages: List[Dict]) -> List[Dict]:
        """
        过滤出未处理的新消息
        
        Args:
            messages: 消息列表
            
        Returns:
            未处理的消息列表
        """
        new_messages = []
        
        for msg in messages:
            content = msg.get('content', '')
            if not self.is_processed(content):
                new_messages.append(msg)
                
        logger.info(f"过滤后剩余 {len(new_messages)} 条新消息（原 {len(messages)} 条）")
        return new_messages
        
    def mark_batch_processed(self, messages: List[Dict]):
        """批量标记消息为已处理"""
        for msg in messages:
            content = msg.get('content', '')
            self.mark_processed(content)
        self.save_cache()
        
    def cleanup_old_records(self, days: int = 7):
        """
        清理过期记录
        
        Args:
            days: 保留多少天的记录
        """
        cutoff = datetime.now() - timedelta(days=days)
        cutoff_str = cutoff.isoformat()
        
        old_count = len(self.processed)
        self.processed = {
            k: v for k, v in self.processed.items()
            if v > cutoff_str
        }
        new_count = len(self.processed)
        
        if old_count != new_count:
            logger.info(f"清理了 {old_count - new_count} 条过期记录")
            self.save_cache()


class TitleDeduplicator:
    """标题去重器（用于发布前检查）"""
    
    def __init__(self, cache_file: str = "./published_titles.json"):
        self.cache_file = Path(cache_file)
        self.published: Dict[str, str] = {}
        self.load_cache()
        
    def load_cache(self):
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    self.published = json.load(f)
            except:
                self.published = {}
                
    def save_cache(self):
        try:
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(self.published, f, ensure_ascii=False, indent=2)
        except:
            pass
            
    def normalize_title(self, title: str) -> str:
        """标准化标题（去除空格、统一大小写等）"""
        return title.strip().lower().replace(' ', '')
        
    def is_published(self, title: str, hours: int = 24) -> bool:
        """检查标题是否已发布"""
        normalized = self.normalize_title(title)
        
        if normalized not in self.published:
            return False
            
        # 检查是否在时间范围内
        published_time = self.published[normalized]
        cutoff = (datetime.now() - timedelta(hours=hours)).isoformat()
        
        return published_time > cutoff
        
    def mark_published(self, title: str):
        """标记标题为已发布"""
        normalized = self.normalize_title(title)
        self.published[normalized] = datetime.now().isoformat()
        self.save_cache()
        
    def filter_unpublished(self, items: List[Dict], hours: int = 24) -> List[Dict]:
        """过滤出未发布的条目"""
        unpublished = []
        
        for item in items:
            title = item.get('title', '')
            if not self.is_published(title, hours):
                unpublished.append(item)
                
        return unpublished
