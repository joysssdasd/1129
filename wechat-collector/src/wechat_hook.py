"""
微信消息实时获取模块
使用 WeChatFerry 实时 Hook 微信获取消息
"""

import time
import queue
import threading
from typing import List, Dict, Callable, Optional
from loguru import logger

try:
    from wcferry import Wcf, WxMsg
    HAS_WCF = True
except ImportError:
    HAS_WCF = False
    logger.warning("wcferry未安装，请运行: pip install wcferry")


class WeChatHook:
    """微信消息实时获取器"""
    
    def __init__(self):
        """初始化"""
        if not HAS_WCF:
            raise ImportError("wcferry未安装")
            
        self.wcf: Optional[Wcf] = None
        self.msg_queue = queue.Queue()
        self.running = False
        self.callbacks: List[Callable] = []
        self.monitor_groups: List[str] = []  # 监控的群名称
        self.group_wxids: Dict[str, str] = {}  # 群名称 -> 群wxid 映射
        
    def start(self) -> bool:
        """
        启动微信Hook
        
        Returns:
            是否启动成功
        """
        try:
            logger.info("正在连接微信...")
            self.wcf = Wcf()
            
            if not self.wcf.is_login():
                logger.error("微信未登录，请先登录微信")
                return False
                
            # 获取登录信息
            user_info = self.wcf.get_user_info()
            logger.info(f"已连接微信: {user_info.get('name', '未知')} ({user_info.get('wxid', '')})")
            
            # 启用消息接收
            self.wcf.enable_receiving_msg()
            self.running = True
            
            # 启动消息处理线程
            self._start_msg_thread()
            
            logger.info("微信Hook启动成功")
            return True
            
        except Exception as e:
            logger.error(f"启动微信Hook失败: {e}")
            return False
            
    def stop(self):
        """停止微信Hook"""
        self.running = False
        if self.wcf:
            try:
                self.wcf.disable_recv_msg()
            except:
                pass
        logger.info("微信Hook已停止")
        
    def _start_msg_thread(self):
        """启动消息接收线程"""
        def msg_receiver():
            while self.running:
                try:
                    msg = self.wcf.get_msg()
                    if msg:
                        self._process_message(msg)
                except Exception as e:
                    if self.running:
                        logger.error(f"接收消息出错: {e}")
                    time.sleep(0.1)
                    
        thread = threading.Thread(target=msg_receiver, daemon=True)
        thread.start()
        logger.info("消息接收线程已启动")
        
    def _process_message(self, msg: 'WxMsg'):
        """处理接收到的消息"""
        try:
            # 只处理群消息
            if not msg.from_group():
                return
                
            # 获取群名称
            group_name = self._get_group_name(msg.roomid)
            
            # 检查是否是监控的群
            if self.monitor_groups and group_name not in self.monitor_groups:
                return
                
            # 只处理文本消息
            if msg.type != 1:  # 1 = 文本消息
                return
                
            # 构建消息数据
            msg_data = {
                'group_id': msg.roomid,
                'group_name': group_name,
                'sender_wxid': msg.sender,
                'content': msg.content,
                'timestamp': msg.ts,
                'msg_id': msg.id
            }
            
            logger.debug(f"收到群消息: [{group_name}] {msg.content[:50]}...")
            
            # 放入队列
            self.msg_queue.put(msg_data)
            
            # 触发回调
            for callback in self.callbacks:
                try:
                    callback(msg_data)
                except Exception as e:
                    logger.error(f"回调执行出错: {e}")
                    
        except Exception as e:
            logger.error(f"处理消息出错: {e}")
            
    def _get_group_name(self, roomid: str) -> str:
        """获取群名称"""
        if roomid in self.group_wxids:
            return self.group_wxids[roomid]
            
        try:
            contacts = self.wcf.get_contacts()
            for contact in contacts:
                if contact.get('wxid') == roomid:
                    name = contact.get('name', roomid)
                    self.group_wxids[roomid] = name
                    return name
        except:
            pass
            
        return roomid
        
    def set_monitor_groups(self, group_names: List[str]):
        """设置要监控的群"""
        self.monitor_groups = group_names
        logger.info(f"设置监控群: {group_names}")
        
        # 预加载群wxid映射
        self._load_group_mapping()
        
    def _load_group_mapping(self):
        """加载群名称和wxid的映射"""
        if not self.wcf:
            return
            
        try:
            contacts = self.wcf.get_contacts()
            for contact in contacts:
                wxid = contact.get('wxid', '')
                name = contact.get('name', '')
                if '@chatroom' in wxid and name:
                    self.group_wxids[wxid] = name
                    # 反向映射
                    if name in self.monitor_groups:
                        logger.info(f"找到监控群: {name} -> {wxid}")
        except Exception as e:
            logger.error(f"加载群映射失败: {e}")
            
    def add_callback(self, callback: Callable):
        """添加消息回调"""
        self.callbacks.append(callback)
        
    def get_messages(self, timeout: float = 1.0) -> List[Dict]:
        """
        获取队列中的消息
        
        Args:
            timeout: 超时时间（秒）
            
        Returns:
            消息列表
        """
        messages = []
        try:
            while True:
                msg = self.msg_queue.get(timeout=timeout)
                messages.append(msg)
        except queue.Empty:
            pass
        return messages
        
    def get_all_groups(self) -> List[Dict]:
        """获取所有群列表"""
        if not self.wcf:
            return []
            
        groups = []
        try:
            contacts = self.wcf.get_contacts()
            for contact in contacts:
                wxid = contact.get('wxid', '')
                if '@chatroom' in wxid:
                    groups.append({
                        'wxid': wxid,
                        'name': contact.get('name', wxid)
                    })
        except Exception as e:
            logger.error(f"获取群列表失败: {e}")
            
        return groups
