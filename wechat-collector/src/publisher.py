"""
自动发布模块
调用交易平台API自动发布解析后的交易信息
"""

import httpx
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from loguru import logger


class Publisher:
    """交易信息发布器"""
    
    DEFAULT_WECHAT_ID = "niuniubase"  # 默认微信号
    
    def __init__(self, supabase_url: str, supabase_key: str, 
                 user_id: str, wechat_id: str = ""):
        """
        初始化发布器
        
        Args:
            supabase_url: Supabase项目URL
            supabase_key: Supabase API密钥
            user_id: 发布者用户ID
            wechat_id: 发布者微信号（默认使用 niuniubase）
        """
        self.supabase_url = supabase_url.rstrip('/')
        self.supabase_key = supabase_key
        self.user_id = user_id
        self.wechat_id = wechat_id or self.DEFAULT_WECHAT_ID
        self.headers = {
            'Authorization': f'Bearer {supabase_key}',
            'apikey': supabase_key,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
        
    def check_duplicate(self, title: str, hours: int = 24) -> bool:
        """
        检查是否重复发布
        
        Args:
            title: 帖子标题
            hours: 检查多少小时内的帖子
            
        Returns:
            True表示重复，False表示不重复
        """
        try:
            since_time = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
            
            response = httpx.get(
                f"{self.supabase_url}/rest/v1/posts",
                headers=self.headers,
                params={
                    'select': 'id,title',
                    'user_id': f'eq.{self.user_id}',
                    'title': f'eq.{title}',
                    'created_at': f'gte.{since_time}'
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                return len(data) > 0
                
            return False
            
        except Exception as e:
            logger.warning(f"检查重复失败: {e}")
            return False
            
    def publish_single(self, item: Dict) -> bool:
        """
        发布单条交易信息
        
        Args:
            item: 交易信息字典，包含title, price, keywords, trade_type, description
            
        Returns:
            是否发布成功
        """
        title = item.get('title', '')
        
        # 检查重复
        if self.check_duplicate(title):
            logger.info(f"跳过重复帖子: {title}")
            return False
            
        # 准备发布数据
        keywords = item.get('keywords', [])
        if isinstance(keywords, list):
            keywords = ','.join(keywords)
            
        post_data = {
            'user_id': self.user_id,
            'title': title,
            'price': float(item.get('price', 0)),
            'keywords': keywords,
            'trade_type': item.get('trade_type', 2),
            'description': item.get('description', ''),
            'view_limit': 100,
            'view_count': 0,
            'status': 1,
            'expire_at': (datetime.utcnow() + timedelta(days=3)).isoformat()
        }
        
        try:
            response = httpx.post(
                f"{self.supabase_url}/rest/v1/posts",
                headers=self.headers,
                json=post_data,
                timeout=10.0
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"✅ 发布成功: {title}")
                return True
            else:
                logger.error(f"❌ 发布失败: {title}, 错误: {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ 发布异常: {title}, 错误: {e}")
            return False
            
    def publish_batch(self, items: List[Dict]) -> Dict:
        """
        批量发布交易信息
        
        Args:
            items: 交易信息列表
            
        Returns:
            发布结果统计
        """
        results = {
            'total': len(items),
            'success': 0,
            'skipped': 0,
            'failed': 0,
            'details': []
        }
        
        for item in items:
            title = item.get('title', '未知')
            
            if self.check_duplicate(title):
                results['skipped'] += 1
                results['details'].append({
                    'title': title,
                    'status': 'skipped',
                    'reason': '重复'
                })
                continue
                
            if self.publish_single(item):
                results['success'] += 1
                results['details'].append({
                    'title': title,
                    'status': 'success'
                })
            else:
                results['failed'] += 1
                results['details'].append({
                    'title': title,
                    'status': 'failed'
                })
                
        logger.info(f"批量发布完成: 成功{results['success']}, 跳过{results['skipped']}, 失败{results['failed']}")
        return results


class EdgeFunctionPublisher(Publisher):
    """使用Edge Function发布（推荐，与前端一致）"""
    
    def publish_via_edge_function(self, items: List[Dict]) -> Dict:
        """
        通过Edge Function批量发布
        
        Args:
            items: 交易信息列表，每条可包含 sender_wxid 字段
            
        Returns:
            发布结果
        """
        # 准备草稿数据
        drafts = []
        for item in items:
            keywords = item.get('keywords', [])
            if isinstance(keywords, list):
                keywords = ','.join(keywords)
            
            # 优先使用消息中提取的微信号，没有则用默认的
            item_wechat_id = item.get('sender_wxid') or self.wechat_id or self.DEFAULT_WECHAT_ID
                
            drafts.append({
                'title': item.get('title', ''),
                'price': float(item.get('price', 0)),
                'keywords': keywords,
                'trade_type': item.get('trade_type', 2),
                'description': item.get('description', ''),
                'user_id': self.user_id,
                'wechat_id': item_wechat_id
            })
            
            logger.debug(f"准备发布: {item.get('title')} - 微信号: {item_wechat_id}")
            
        try:
            # 调用Edge Function
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
                logger.info(f"Edge Function发布完成: {data.get('message', '')}")
                return {
                    'success': data.get('success_count', 0),
                    'total': data.get('total_count', len(items)),
                    'errors': data.get('errors', [])
                }
            else:
                logger.error(f"Edge Function调用失败: {response.text}")
                return {'success': 0, 'total': len(items), 'error': response.text}
                
        except Exception as e:
            logger.error(f"Edge Function调用异常: {e}")
            return {'success': 0, 'total': len(items), 'error': str(e)}
