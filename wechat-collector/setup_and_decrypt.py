"""
微信数据库解密工具
使用 pywxdump 获取密钥并解密数据库

使用方法：
1. 确保微信已登录并运行
2. 运行: python setup_and_decrypt.py

依赖安装：
pip install pywxdump
"""

import os
import sys
import json
import subprocess
from pathlib import Path

def check_pywxdump():
    """检查 pywxdump 是否安装"""
    try:
        import pywxdump
        return True
    except ImportError:
        return False

def install_pywxdump():
    """安装 pywxdump"""
    print("正在安装 pywxdump...")
    subprocess.run([sys.executable, "-m", "pip", "install", "pywxdump", "-q"])
    print("安装完成！")

def get_wechat_info():
    """获取微信信息和密钥"""
    try:
        from pywxdump import WX_OFFS, get_wechat_db, get_core_db
        from pywxdump.wx_info import get_wx_info
        
        print("\n正在获取微信信息...")
        print("请确保微信已登录并运行中...\n")
        
        # 获取微信信息
        wx_info = get_wx_info()
        
        if not wx_info:
            print("未能获取微信信息，请确保：")
            print("1. 微信已登录")
            print("2. 以管理员权限运行此脚本")
            return None
            
        for info in wx_info:
            print(f"微信版本: {info.get('version', 'unknown')}")
            print(f"微信昵称: {info.get('name', 'unknown')}")
            print(f"微信ID: {info.get('wxid', 'unknown')}")
            print(f"数据目录: {info.get('filePath', 'unknown')}")
            print(f"密钥: {info.get('key', 'unknown')}")
            print("-" * 50)
            
        return wx_info
        
    except Exception as e:
        print(f"获取微信信息失败: {e}")
        return None

def decrypt_database(key: str, db_path: str, output_path: str):
    """解密数据库"""
    try:
        from pywxdump.db.dbMSG import decrypt
        
        print(f"\n正在解密数据库...")
        print(f"源文件: {db_path}")
        print(f"输出文件: {output_path}")
        
        decrypt(key, db_path, output_path)
        print("解密成功！")
        return True
        
    except Exception as e:
        print(f"解密失败: {e}")
        return False

def update_config(key: str):
    """更新配置文件中的密钥"""
    config_path = Path(__file__).parent / "config.json"
    
    if config_path.exists():
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        config['wechat']['db_key'] = key
        
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
            
        print(f"\n已更新 config.json 中的密钥")

def main():
    print("=" * 60)
    print("微信数据库解密工具")
    print("=" * 60)
    
    # 检查并安装 pywxdump
    if not check_pywxdump():
        install_pywxdump()
    
    # 获取微信信息
    wx_info = get_wechat_info()
    
    if wx_info and len(wx_info) > 0:
        info = wx_info[0]
        key = info.get('key', '')
        
        if key:
            print(f"\n获取到密钥: {key}")
            
            # 更新配置
            update_config(key)
            
            # 解密数据库
            wxid = info.get('wxid', '')
            file_path = info.get('filePath', '')
            
            if file_path and wxid:
                db_path = Path(file_path) / "db_storage" / "message" / "message_0.db"
                output_dir = Path(__file__).parent / "decrypted_db"
                output_dir.mkdir(exist_ok=True)
                output_path = output_dir / "message_0_decrypted.db"
                
                if db_path.exists():
                    decrypt_database(key, str(db_path), str(output_path))
                else:
                    print(f"数据库文件不存在: {db_path}")
        else:
            print("未能获取密钥")
    else:
        print("\n未能获取微信信息")
        print("\n请尝试以下方法：")
        print("1. 以管理员身份运行命令提示符")
        print("2. 运行: wxdump info")
        print("3. 手动将获取到的 key 填入 config.json")

if __name__ == "__main__":
    main()
