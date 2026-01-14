"""测试 WeChatFerry 连接"""
import sys
import os

# 设置微信路径
os.environ['WECHAT_PATH'] = r'D:\WeChat'

try:
    from wcferry import Wcf
    print("正在连接微信...")
    print("微信路径:", os.environ.get('WECHAT_PATH'))
    
    wcf = Wcf(debug=True)
    print("连接成功!")
    print("登录状态:", wcf.is_login())
    
    if wcf.is_login():
        info = wcf.get_self_wxid()
        print("当前微信ID:", info)
        
        # 获取群列表
        contacts = wcf.get_contacts()
        groups = [c for c in contacts if c.get('wxid', '').endswith('@chatroom')]
        print(f"群数量: {len(groups)}")
        for g in groups[:5]:
            print(f"  - {g.get('name', '未知')}")
    
    wcf.cleanup()
    
except Exception as e:
    print(f"错误: {e}")
    import traceback
    traceback.print_exc()
