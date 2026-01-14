"""
微信群消息自动采集工具 - 主程序

功能：
1. 定时从微信群读取消息
2. AI解析交易信息
3. 自动发布到交易平台
"""

import json
import time
import schedule
from pathlib import Path
from datetime import datetime
from loguru import logger

from src.wechat_db import WeChatDB, WeChatKeyExtractor
from src.message_parser import MessageParser, SimpleParser
from src.publisher import Publisher, EdgeFunctionPublisher
from src.dedup import MessageDeduplicator, TitleDeduplicator


# 配置日志
logger.add(
    "logs/collector_{time:YYYY-MM-DD}.log",
    rotation="1 day",
    retention="7 days",
    level="INFO"
)


class WeChatCollector:
    """微信消息采集器"""
    
    def __init__(self, config_path: str = "config.json"):
        """
        初始化采集器
        
        Args:
            config_path: 配置文件路径
        """
        self.config = self.load_config(config_path)
        self.setup_components()
        
    def load_config(self, config_path: str) -> dict:
        """加载配置"""
        config_file = Path(config_path)
        
        if not config_file.exists():
            logger.error(f"配置文件不存在: {config_path}")
            logger.info("请复制 config.example.json 为 config.json 并填写配置")
            raise FileNotFoundError(f"配置文件不存在: {config_path}")
            
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
            
        logger.info("配置加载成功")
        return config
        
    def setup_components(self):
        """初始化各组件"""
        wechat_config = self.config.get('wechat', {})
        platform_config = self.config.get('platform', {})
        ai_config = self.config.get('ai', {})
        
        # 微信数据库读取器
        self.wechat_db = WeChatDB(
            data_path=wechat_config.get('data_path', ''),
            wxid=wechat_config.get('wxid', ''),
            db_key=wechat_config.get('db_key', '')
        )
        
        # AI解析器
        self.ai_parser = MessageParser(
            api_key=ai_config.get('deepseek_api_key', ''),
            model=ai_config.get('model', 'deepseek-chat')
        )
        
        # 简单解析器（备用）
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
        
        logger.info("组件初始化完成")
        
    def collect_and_publish(self):
        """执行一次采集和发布"""
        logger.info("=" * 50)
        logger.info(f"开始采集任务 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        try:
            # 1. 读取微信消息
            group_names = self.config.get('monitor_groups', [])
            schedule_config = self.config.get('schedule', {})
            hours_ago = schedule_config.get('interval_minutes', 60) / 60 * 2  # 读取2倍间隔时间的消息
            
            messages = self.wechat_db.get_group_messages(group_names, int(hours_ago) + 1)
            
            if not messages:
                logger.info("没有读取到新消息")
                return
                
            logger.info(f"读取到 {len(messages)} 条消息")
            
            # 2. 过滤已处理的消息
            new_messages = self.msg_dedup.filter_new_messages(messages)
            
            if not new_messages:
                logger.info("没有新消息需要处理")
                return
                
            # 3. 过滤交易相关消息
            filter_config = self.config.get('filter', {})
            trade_messages = self.ai_parser.filter_trade_messages(
                new_messages,
                keywords=filter_config.get('keywords', ['出', '收', '转', '票']),
                min_length=filter_config.get('min_message_length', 10),
                max_length=filter_config.get('max_message_length', 2000)
            )
            
            if not trade_messages:
                logger.info("没有交易相关消息")
                self.msg_dedup.mark_batch_processed(new_messages)
                return
                
            # 4. AI解析交易信息
            logger.info(f"开始AI解析 {len(trade_messages)} 条消息...")
            parsed_items = []
            
            for msg in trade_messages:
                content = msg.get('content', '')
                sender_wxid = msg.get('sender_wxid')  # 获取发送者微信号
                
                # AI解析
                items = self.ai_parser.parse_with_ai(content)
                
                # 如果AI解析失败，尝试简单解析
                if not items:
                    items = self.simple_parser.parse(content)
                
                # 给每条解析结果附加发送者微信号
                for item in items:
                    if sender_wxid:
                        item['sender_wxid'] = sender_wxid
                    parsed_items.append(item)
                    
            if not parsed_items:
                logger.info("未解析出交易信息")
                self.msg_dedup.mark_batch_processed(new_messages)
                return
                
            logger.info(f"解析出 {len(parsed_items)} 条交易信息")
            
            # 5. 去重
            unique_items = self.title_dedup.filter_unpublished(parsed_items)
            
            if not unique_items:
                logger.info("所有交易信息都已发布过")
                self.msg_dedup.mark_batch_processed(new_messages)
                return
                
            logger.info(f"去重后剩余 {len(unique_items)} 条待发布")
            
            # 6. 发布
            result = self.publisher.publish_via_edge_function(unique_items)
            
            logger.info(f"发布结果: 成功 {result.get('success', 0)}/{result.get('total', 0)}")
            
            # 7. 标记已处理
            self.msg_dedup.mark_batch_processed(new_messages)
            for item in unique_items:
                self.title_dedup.mark_published(item.get('title', ''))
                
            # 8. 清理过期记录
            self.msg_dedup.cleanup_old_records(days=7)
            
        except Exception as e:
            logger.error(f"采集任务出错: {e}")
            import traceback
            logger.error(traceback.format_exc())
            
        logger.info("采集任务完成")
        logger.info("=" * 50)

    def run_scheduler(self):
        """运行定时任务"""
        schedule_config = self.config.get('schedule', {})
        interval = schedule_config.get('interval_minutes', 60)
        start_hour = schedule_config.get('start_hour', 8)
        end_hour = schedule_config.get('end_hour', 23)
        
        logger.info(f"定时任务配置: 每{interval}分钟执行一次，运行时间 {start_hour}:00 - {end_hour}:00")
        
        def job_wrapper():
            """任务包装器，检查运行时间"""
            current_hour = datetime.now().hour
            if start_hour <= current_hour < end_hour:
                self.collect_and_publish()
            else:
                logger.debug(f"当前时间 {current_hour}:00 不在运行时间范围内")
                
        # 设置定时任务
        schedule.every(interval).minutes.do(job_wrapper)
        
        # 立即执行一次
        logger.info("立即执行首次采集...")
        job_wrapper()
        
        # 运行调度器
        logger.info("定时任务已启动，按 Ctrl+C 停止")
        
        while True:
            schedule.run_pending()
            time.sleep(60)  # 每分钟检查一次
            
    def run_once(self):
        """执行一次采集（用于测试）"""
        self.collect_and_publish()


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='微信群消息自动采集工具')
    parser.add_argument('--config', '-c', default='config.json', help='配置文件路径')
    parser.add_argument('--once', '-o', action='store_true', help='只执行一次（用于测试）')
    parser.add_argument('--get-key', action='store_true', help='获取微信数据库密钥的帮助')
    
    args = parser.parse_args()
    
    if args.get_key:
        WeChatKeyExtractor.get_key_from_tool()
        return
        
    try:
        collector = WeChatCollector(args.config)
        
        if args.once:
            collector.run_once()
        else:
            collector.run_scheduler()
            
    except KeyboardInterrupt:
        logger.info("程序已停止")
    except Exception as e:
        logger.error(f"程序出错: {e}")
        import traceback
        logger.error(traceback.format_exc())


if __name__ == '__main__':
    main()
