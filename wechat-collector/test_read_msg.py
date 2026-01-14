"""测试读取微信群消息"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

import uiautomation as auto
import time

# 找到微信窗口
wechat = auto.WindowControl(searchDepth=1, ClassName='WeChatMainWndForPC')
if not wechat.Exists(maxSearchSeconds=3):
    print("未找到微信窗口")
    exit()

print("找到微信窗口")

# 获取会话列表
chat_list = wechat.ListControl(Name='会话')
if chat_list.Exists():
    items = chat_list.GetChildren()
    print(f"\n会话列表 (共{len(items)}个):")
    for i, item in enumerate(items[:10]):
        print(f"  {i+1}. {item.Name}")
        
    # 点击第一个群聊
    if items:
        target = None
        for item in items:
            if '群' in item.Name or '@chatroom' in str(item):
                target = item
                break
        if not target:
            target = items[0]
            
        print(f"\n点击: {target.Name}")
        target.Click()
        time.sleep(1)
        
        # 读取消息
        msg_list = wechat.ListControl(Name='消息')
        if msg_list.Exists(maxSearchSeconds=3):
            msgs = msg_list.GetChildren()
            print(f"\n消息列表 (最近{min(10, len(msgs))}条):")
            for msg in msgs[-10:]:
                text = msg.Name or ''
                if text and len(text) > 5:
                    print(f"  - {text[:80]}...")
        else:
            print("未找到消息列表")
else:
    print("未找到会话列表")
