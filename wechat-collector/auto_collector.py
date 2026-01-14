"""
微信群消息自动采集工具 - 实时版
使用 WeChatFerry 实时获取消息，自动解析并发布
"""

import json
import time
import threading
from pathlib import Path
from datetime import datetime
from loguru import logger

from src.wechat_hook import WeChatHook
from src.message_parser import MessageParser, SimpleParser
from src.publisher import EdgeFunctionPublisher
from src.dedup import MessageDeduplicator, TitleDeduplicator


# 配置日志
logger.add(
    "logs/auto_collector_{time:YYYY-MM-DD}.log",
    rotation="1 day",
    retention="7 days",
    level="INFO"
)


class AutoCollector:
    """自动采集器"""
    
    def __init__(self, config_path: str = "config.json"):
        self.config = self.load_config(config_path)
        self.setup_components()
        self.pending_messages = []
        self.lock = threading.Lock()
        
    def load_config(self, config_path: str) -> dict:
        """加载配置"""
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
            
    def setup_components(self):
        """初始化组件"""
        platform_config = self.config.get('platform', {})
        ai_config = self.config.get('ai', {})
        
        # 微信Hook
        self.wechat = WeChatHook()
        
        # AI解析器
        self.ai_parser = MessageParser(
            api_key=ai_config.get('deepseek_api_key', ''),
            model=ai_config.get('model', 'deepseek-chat')
        )
        
        # 简单解析器
        self.simple_parser = SimpleParser()
        
        # 发布器
        self.publisher = EdgeFunctionPublisher(
            supabase_url=platform_config.get('supabase_url', ''),
            supabase_key=platform_config.get('supabase_anon_key', ''),
            user_id=platform_config.get('user_id', ''),
            wechat_id=platform_config.get('default_wechat_id', 'niuniubase')
        )
        
        # 去重器
        self.msg_dedup = MessageDeduplicator()
        self.title_dedup = TitleDeduplicator()
        
    def on_message(self, msg: dict):
        """消息回调 - 收到新消息时触发"""
        content = msg.get('content', '')
        
        # 检查是否已处理
        if self.msg_dedup.is_processed(content):
            return
            
        # 关键词过滤
        filter_config = self.config.get('filter', {})
        keywords = filter_config.get('keywords', [])
        min_len = filter_config.get('min_message_length', 10)
        max_len = filter_config.get('max_message_length', 2000)
        
        if len(content) < min_len or len(content) > max_len:
            return
            
        if not any(kw in content for kw in keywords):
            return
            
        logger.info(f"收到交易消息: [{msg.get('group_name')}] {content[:80]}...")
        
        # 添加到待处理队列
        with self.lock:
            self.pending_messages.append(msg)
            
    def process_pending_messages(self):
        """处理待发布的消息"""
        with self.lock:
            if not self.pending_messages:
                return
            messages = self.pending_messages.copy()
            self.pending_messages.clear()
            
        logger.info(f"开始处理 {len(messages)} 条待发布消息")
        
        all_items = []
        
        for msg in messages:
            content = msg.get('content', '')
            sender_wxid = msg.get('sender_wxid', '')
            
            # AI解析
            items = self.ai_parser.parse_with_ai(content)
            
            # 如果AI解析失败，用简单解析
            if not items:
                items = self.simple_parser.parse(content)
                
            # 附加发送者微信号
            for item in items:
                if sender_wxid:
                    item['sender_wxid'] = sender_wxid
                all_items.append(item)
                
            # 标记已处理
            self.msg_dedup.mark_processed(content)
            
        if not all_items:
            logger.info("未解析出交易信息")
            return
            
        logger.info(f"解析出 {len(all_items)} 条交易信息")
        
        # 去重
        unique_items = self.title_dedup.filter_unpublished(all_items)
        
        if not unique_items:
            logger.info("所有信息都已发布过")
            return
            
        # 发布
        result = self.publisher.publish_via_edge_function(unique_items)
        logger.info(f"发布结果: 成功 {result.get('success', 0)}/{result.get('total', 0)}")
        
        # 标记已发布
        for item in unique_items:
            self.title_dedup.mark_published(item.get('title', ''))
            
        self.msg_dedup.save_cache()
        
    def run(self):
        """运行自动采集"""
        logger.info("=" * 50)
        logger.info("微信群消息自动采集工具 - 实时版")
        logger.info("=" * 50)
        
        # 启动微信Hook
        if not self.wechat.start():
            logger.error("启动失败，请确保微信已登录")
            return
            
        # 设置监控群
        monitor_groups = self.config.get('monitor_groups', [])
        self.wechat.set_monitor_groups(monitor_groups)
        
        # 添加消息回调
        self.wechat.add_callback(self.on_message)
        
        # 获取处理间隔
        schedule_config = self.config.get('schedule', {})
        interval = schedule_config.get('interval_minutes', 60) * 60  # 转换为秒
        
        logger.info(f"自动采集已启动，每 {interval//60} 分钟处理一次")
        logger.info("按 Ctrl+C 停止")
        
        try:
            last_process_time = time.time()
            
            while True:
                time.sleep(10)  # 每10秒检查一次
                
                # 检查是否到处理时间
                if time.time() - last_process_time >= interval:
                    self.process_pending_messages()
                    last_process_time = time.time()
                    
        except KeyboardInterrupt:
            logger.info("正在停止...")
        finally:
            self.wechat.stop()
            self.msg_dedup.save_cache()
            logger.info("自动采集已停止")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='微信群消息自动采集工具')
    parser.add_argument('--config', '-c', default='config.json', help='配置文件路径')
    parser.add_argument('--list-groups', action='store_true', help='列出所有群')
    parser.add_argument('--interval', '-i', type=int, help='处理间隔（分钟）')
    
    args = parser.parse_args()
    
    if args.list_groups:
        # 列出所有群
        hook = WeChatHook()
        if hook.start():
            groups = hook.get_all_groups()
            print("\n所有群列表：")
            for g in groups:
                print(f"  - {g['name']} ({g['wxid']})")
            hook.stop()
        return
        
    collector = AutoCollector(args.config)
    
    if args.interval:
        collector.config['schedule']['interval_minutes'] = args.interval
        
    collector.run()


if __name__ == '__main__':
    main()
