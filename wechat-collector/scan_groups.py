"""扫描所有群，检查哪些有交易信息"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
import uiautomation as auto
import time

keywords = ['出', '收', '转', '票', '演唱会', '门票', '白银', '金条', '克', '元']

wechat = auto.WindowControl(searchDepth=1, ClassName='WeChatMainWndForPC')
chat_list = wechat.ListControl(Name='会话')
items = chat_list.GetChildren()

trade_groups = []

print("扫描群聊中...\n")

for item in items[:20]:
    name = item.Name or ''
    if not name or '订阅号' in name:
        continue
        
    # 点击会话
    item.Click()
    time.sleep(0.8)
    
    # 读取消息
    msg_list = wechat.ListControl(Name='消息')
    if not msg_list.Exists(maxSearchSeconds=1):
        continue
        
    msgs = msg_list.GetChildren()
    trade_count = 0
    
    for msg in msgs[-20:]:
        text = msg.Name or ''
        if any(kw in text for kw in keywords) and len(text) > 15:
            trade_count += 1
            
    if trade_count >= 2:
        trade_groups.append((name, trade_count))
        print(f"[有交易] {name} - 发现{trade_count}条交易相关消息")
    else:
        print(f"[跳过] {name}")

print("\n" + "="*50)
print("建议监控的群:")
for g, c in trade_groups:
    # 去掉"已置顶"后缀
    clean_name = g.replace('已置顶', '').strip()
    print(f'  "{clean_name}",')
