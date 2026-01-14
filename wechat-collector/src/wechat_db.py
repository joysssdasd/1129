"""
微信数据库读取模块
负责解密和读取微信本地SQLite数据库中的聊天记录
"""

import os
import sqlite3
import shutil
import hashlib
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from loguru import logger

try:
    from Crypto.Cipher import AES
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False
    logger.warning("pycryptodome未安装，将无法解密数据库")


class WeChatDB:
    """微信数据库读取类"""
    
    def __init__(self, data_path: str, wxid: str = "", db_key: str = ""):
        """
        初始化
        
        Args:
            data_path: 微信数据目录，如 C:\\Users\\xxx\\Documents\\WeChat Files
            wxid: 微信ID（可选，自动检测）
            db_key: 数据库解密密钥（可选，可通过get_key获取）
        """
        self.data_path = Path(data_path)
        self.wxid = wxid
        self.db_key = db_key
        self.temp_dir = Path("./temp_db")
        self.temp_dir.mkdir(exist_ok=True)
        
    def find_wxid(self) -> Optional[str]:
        """自动查找微信ID"""
        if self.wxid:
            return self.wxid
            
        # 遍历WeChat Files目录，查找wxid_开头的文件夹
        for item in self.data_path.iterdir():
            if item.is_dir() and item.name.startswith("wxid_"):
                self.wxid = item.name
                logger.info(f"找到微信ID: {self.wxid}")
                return self.wxid
                
        # 如果没有wxid_开头的，取第一个非All Users的目录
        for item in self.data_path.iterdir():
            if item.is_dir() and item.name not in ["All Users", "Applet"]:
                self.wxid = item.name
                logger.info(f"使用微信账号目录: {self.wxid}")
                return self.wxid
                
        logger.error("未找到微信数据目录")
        return None
        
    def get_msg_db_path(self) -> Optional[Path]:
        """获取消息数据库路径"""
        if not self.find_wxid():
            return None
            
        wxid_path = self.data_path / self.wxid
        
        # 新版微信 (3.9+): db_storage/message/message_0.db
        new_msg_path = wxid_path / "db_storage" / "message"
        if new_msg_path.exists():
            for db_file in new_msg_path.glob("message_*.db"):
                if not db_file.name.endswith('-shm') and not db_file.name.endswith('-wal'):
                    logger.info(f"找到新版消息数据库: {db_file}")
                    return db_file
                    
        # 旧版微信: Msg/Multi/MSG*.db
        msg_path = wxid_path / "Msg"
        multi_path = msg_path / "Multi"
        if multi_path.exists():
            for db_file in multi_path.glob("MSG*.db"):
                logger.info(f"找到旧版消息数据库: {db_file}")
                return db_file
                
        # 更旧版本: Msg/ChatMsg.db
        old_db = msg_path / "ChatMsg.db"
        if old_db.exists():
            return old_db
            
        logger.error("未找到消息数据库")
        return None
        
    def copy_db_for_reading(self, db_path: Path) -> Optional[Path]:
        """
        复制数据库文件以便读取（微信运行时数据库被锁定）
        
        Args:
            db_path: 原数据库路径
            
        Returns:
            复制后的数据库路径
        """
        temp_db = self.temp_dir / f"temp_{db_path.name}"
        try:
            shutil.copy2(db_path, temp_db)
            logger.info(f"已复制数据库到: {temp_db}")
            return temp_db
        except PermissionError:
            logger.error("无法复制数据库，请确保微信已关闭或使用管理员权限运行")
            return None
        except Exception as e:
            logger.error(f"复制数据库失败: {e}")
            return None

    def decrypt_db(self, encrypted_db: Path, key: bytes) -> Optional[Path]:
        """
        解密微信数据库
        
        Args:
            encrypted_db: 加密的数据库文件
            key: 解密密钥（32字节）
            
        Returns:
            解密后的数据库路径
        """
        if not HAS_CRYPTO:
            logger.error("需要安装pycryptodome: pip install pycryptodome")
            return None
            
        decrypted_path = self.temp_dir / f"decrypted_{encrypted_db.name}"
        
        try:
            with open(encrypted_db, 'rb') as f:
                encrypted_data = f.read()
                
            # 微信数据库使用SQLCipher加密
            # 页大小4096，保留字节16
            page_size = 4096
            reserve_size = 16
            
            # 第一页包含salt
            salt = encrypted_data[:16]
            
            # 派生密钥
            derived_key = hashlib.pbkdf2_hmac(
                'sha1', key, salt, 64000, dklen=32
            )
            
            decrypted_pages = []
            
            # 解密每一页
            for i in range(0, len(encrypted_data), page_size):
                page = encrypted_data[i:i + page_size]
                if len(page) < page_size:
                    break
                    
                # 提取IV和加密数据
                iv = page[-reserve_size:-reserve_size + 16] if i > 0 else bytes(16)
                encrypted_content = page[:-reserve_size] if i > 0 else page[16:-reserve_size]
                
                # AES解密
                cipher = AES.new(derived_key, AES.MODE_CBC, iv)
                decrypted = cipher.decrypt(encrypted_content)
                
                decrypted_pages.append(decrypted)
                
            # 写入解密后的数据库
            with open(decrypted_path, 'wb') as f:
                f.write(b''.join(decrypted_pages))
                
            logger.info(f"数据库解密成功: {decrypted_path}")
            return decrypted_path
            
        except Exception as e:
            logger.error(f"解密数据库失败: {e}")
            return None
            
    def read_messages_simple(self, db_path: Path, group_names: List[str], 
                             hours_ago: int = 2) -> List[Dict]:
        """
        简单读取消息（适用于未加密或已解密的数据库）
        
        Args:
            db_path: 数据库路径
            group_names: 要监控的群名称列表
            hours_ago: 读取多少小时前的消息
            
        Returns:
            消息列表
        """
        messages = []
        
        try:
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            
            # 计算时间戳（微信使用秒级时间戳）
            since_time = int((datetime.now() - timedelta(hours=hours_ago)).timestamp())
            
            # 查询群消息，包含发送者信息
            # 注意：实际表结构可能因微信版本而异
            # StrTalker: 群ID (xxx@chatroom)
            # BytesExtra: 包含发送者wxid等信息
            # 新版微信可能用不同字段存储发送者
            query = """
                SELECT 
                    m.StrTalker,
                    m.StrContent,
                    m.CreateTime,
                    m.Type,
                    m.BytesExtra
                FROM MSG m
                WHERE m.CreateTime > ?
                AND m.Type = 1
                ORDER BY m.CreateTime DESC
            """
            
            cursor.execute(query, (since_time,))
            rows = cursor.fetchall()
            
            for row in rows:
                talker, content, create_time, msg_type, bytes_extra = row
                
                # 检查是否是目标群
                # 群聊的talker通常是 xxx@chatroom 格式
                if '@chatroom' in str(talker):
                    # 尝试从BytesExtra提取发送者微信号
                    sender_wxid = self._extract_sender_wxid(bytes_extra, content)
                    
                    messages.append({
                        'group_id': talker,
                        'content': content,
                        'timestamp': create_time,
                        'datetime': datetime.fromtimestamp(create_time).isoformat(),
                        'type': msg_type,
                        'sender_wxid': sender_wxid  # 发送者微信号
                    })
                    
            conn.close()
            logger.info(f"读取到 {len(messages)} 条群消息")
            
        except sqlite3.Error as e:
            logger.error(f"读取数据库失败: {e}")
        except Exception as e:
            logger.error(f"读取消息失败: {e}")
            
        return messages
        
    def _extract_sender_wxid(self, bytes_extra: bytes, content: str) -> Optional[str]:
        """
        从BytesExtra或消息内容中提取发送者微信号
        
        Args:
            bytes_extra: 消息的额外字节数据
            content: 消息内容
            
        Returns:
            发送者微信号，提取失败返回None
        """
        sender_wxid = None
        
        # 方法1: 从BytesExtra中提取
        if bytes_extra:
            try:
                # BytesExtra是protobuf格式，wxid通常在其中
                # 简单方法：查找wxid_开头的字符串
                import re
                extra_str = bytes_extra.decode('utf-8', errors='ignore')
                
                # 匹配wxid格式
                wxid_match = re.search(r'(wxid_[a-zA-Z0-9]+)', extra_str)
                if wxid_match:
                    sender_wxid = wxid_match.group(1)
                    logger.debug(f"从BytesExtra提取到wxid: {sender_wxid}")
                    return sender_wxid
                    
                # 匹配手机号格式的微信号
                phone_match = re.search(r'(\d{11})', extra_str)
                if phone_match:
                    sender_wxid = phone_match.group(1)
                    logger.debug(f"从BytesExtra提取到手机号: {sender_wxid}")
                    return sender_wxid
                    
            except Exception as e:
                logger.debug(f"解析BytesExtra失败: {e}")
                
        # 方法2: 从消息内容中查找微信号（有些人会在消息里留微信）
        if content:
            import re
            # 匹配"微信:xxx" 或 "wx:xxx" 或 "V:xxx"格式
            wx_patterns = [
                r'(?:微信|wx|weixin|v|V)[：:\s]*([a-zA-Z0-9_-]{6,20})',
                r'(?:加我|联系)[：:\s]*([a-zA-Z0-9_-]{6,20})',
            ]
            for pattern in wx_patterns:
                match = re.search(pattern, content, re.IGNORECASE)
                if match:
                    sender_wxid = match.group(1)
                    logger.debug(f"从消息内容提取到微信号: {sender_wxid}")
                    return sender_wxid
                    
        return sender_wxid
        
    def get_group_messages(self, group_names: List[str], hours_ago: int = 2) -> List[Dict]:
        """
        获取指定群的消息
        
        Args:
            group_names: 群名称列表
            hours_ago: 获取多少小时内的消息
            
        Returns:
            消息列表
        """
        db_path = self.get_msg_db_path()
        if not db_path:
            return []
            
        # 复制数据库
        temp_db = self.copy_db_for_reading(db_path)
        if not temp_db:
            return []
            
        try:
            # 尝试直接读取（可能未加密）
            messages = self.read_messages_simple(temp_db, group_names, hours_ago)
            return messages
        finally:
            # 清理临时文件
            try:
                temp_db.unlink()
            except:
                pass


class WeChatKeyExtractor:
    """微信数据库密钥提取器（需要微信运行中）"""
    
    @staticmethod
    def get_key_from_memory() -> Optional[bytes]:
        """
        从微信进程内存中提取数据库密钥
        
        Returns:
            32字节的密钥，失败返回None
        """
        try:
            import pymem
            
            pm = pymem.Pymem("WeChat.exe")
            
            # 密钥在内存中的特征模式（可能因版本而异）
            # 这里需要根据具体微信版本调整
            logger.warning("密钥提取功能需要根据微信版本调整，建议使用其他工具获取密钥")
            
            return None
            
        except ImportError:
            logger.error("需要安装pymem: pip install pymem")
            return None
        except Exception as e:
            logger.error(f"提取密钥失败: {e}")
            return None
            
    @staticmethod
    def get_key_from_tool() -> str:
        """
        提示用户使用外部工具获取密钥
        """
        msg = """
获取微信数据库密钥的方法：

1. 使用 pywxdump 工具（推荐）：
   pip install pywxdump
   wxdump info

2. 使用 WeChatMsg 工具：
   https://github.com/LC044/WeChatMsg
   
3. 手动获取：
   - 使用CE等内存工具搜索微信进程
   - 查找32字节的密钥特征

获取到密钥后，填入 config.json 的 wechat.db_key 字段
"""
        print(msg)
        return ""
