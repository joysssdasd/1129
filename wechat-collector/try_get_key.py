"""
尝试从新版微信(WeChatAppEx)获取数据库密钥
"""
import os
import sys

def try_get_key():
    """尝试多种方式获取密钥"""
    
    # 方法1: 尝试 pywxdump 的 bias_addr 方式
    try:
        from pywxdump.wx_info import BiasAddr, get_info_without_key
        print("尝试 BiasAddr 方式...")
        
        # 查找微信进程
        import subprocess
        result = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq WeChat.exe', '/FO', 'CSV'], 
                               capture_output=True, text=True)
        print(f"WeChat.exe 进程: {result.stdout}")
        
        result2 = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq WeChatAppEx.exe', '/FO', 'CSV'], 
                                capture_output=True, text=True)
        print(f"WeChatAppEx.exe 进程: {result2.stdout[:200]}")
        
    except Exception as e:
        print(f"BiasAddr 方式失败: {e}")
    
    # 方法2: 尝试读取配置文件中可能存储的信息
    try:
        import json
        config_path = r"E:\xwechat_files\wxid_yq70a2dy8yg922_ceaf\config"
        if os.path.exists(config_path):
            print(f"\n配置目录内容:")
            for f in os.listdir(config_path):
                print(f"  {f}")
    except Exception as e:
        print(f"读取配置失败: {e}")
        
    # 方法3: 检查 MMKV 文件
    try:
        mmkv_path = r"E:\xwechat_files\wxid_yq70a2dy8yg922_ceaf\db_storage\MMKV"
        if os.path.exists(mmkv_path):
            print(f"\nMMKV目录内容:")
            for f in os.listdir(mmkv_path):
                fpath = os.path.join(mmkv_path, f)
                size = os.path.getsize(fpath)
                print(f"  {f} ({size} bytes)")
    except Exception as e:
        print(f"读取MMKV失败: {e}")

if __name__ == "__main__":
    try_get_key()
