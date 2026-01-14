"""快速测试采集和发布"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

import json
import re
import time
import uiautomation as auto
import httpx

# 加载配置
with open('E:/claude15/wechat-collector/config.json', 'r', encoding='utf-8') as f:
    config = json.load(f)

# 找微信
wechat = auto.WindowControl(searchDepth=1, ClassName='WeChatMainWndForPC')
if not wechat.Exists(maxSearchSeconds=3):
    print("未找到微信")
    exit()

# 点击第一个监控群
chat_list = wechat.ListControl(Name='会话')
for item in chat_list.GetChildren():
    if '广州菜市场' in item.Name:
        item.Click()
        time.sleep(1)
        break

# 读取消息
msg_list = wechat.ListControl(Name='消息')
msgs = msg_list.GetChildren()

# 取最近3条交易消息测试
keywords = ['出', '收', '票', '演唱会', '元']
test_msgs = []
for msg in msgs[-20:]:
    text = msg.Name or ''
    if any(kw in text for kw in keywords) and len(text) > 20:
        test_msgs.append(text)
        if len(test_msgs) >= 2:
            break

print(f"测试消息数: {len(test_msgs)}")
for i, m in enumerate(test_msgs):
    print(f"\n消息{i+1}: {m[:100]}...")

# AI解析
print("\n正在AI解析...")
api_key = config['ai']['deepseek_api_key']
combined = "\n---\n".join(test_msgs)

prompt = f"""解析交易信息，返回JSON数组:
{combined}

格式:[{{"title":"标题","price":数字,"trade_type":2,"keywords":["关键词"]}}]
只返回JSON:"""

try:
    resp = httpx.post(
        "https://api.deepseek.com/chat/completions",
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json={
            'model': 'deepseek-chat',
            'messages': [{'role': 'user', 'content': prompt}],
            'temperature': 0.1
        },
        timeout=60.0
    )
    
    if resp.status_code == 200:
        content = resp.json()['choices'][0]['message']['content']
        print(f"\nAI返回: {content[:500]}")
        
        match = re.search(r'\[[\s\S]*\]', content)
        if match:
            items = json.loads(match.group())
            print(f"\n解析出 {len(items)} 条交易信息:")
            for item in items[:3]:
                print(f"  - {item.get('title')} ￥{item.get('price')}")
                
            # 发布
            if items:
                print("\n正在发布...")
                drafts = []
                for item in items[:2]:  # 只发布2条测试
                    kw = item.get('keywords', [])
                    if isinstance(kw, list):
                        kw = ','.join(kw)
                    drafts.append({
                        'title': item.get('title', ''),
                        'price': float(item.get('price', 0)),
                        'keywords': kw,
                        'trade_type': item.get('trade_type', 2),
                        'description': '',
                        'user_id': config['platform']['user_id'],
                        'wechat_id': config['platform']['default_wechat_id']
                    })
                
                pub_resp = httpx.post(
                    f"{config['platform']['supabase_url']}/functions/v1/ai-batch-publish-v2",
                    headers={
                        'Authorization': f"Bearer {config['platform']['supabase_anon_key']}",
                        'Content-Type': 'application/json'
                    },
                    json={'user_id': config['platform']['user_id'], 'step': 'publish', 'drafts': drafts},
                    timeout=60.0
                )
                
                print(f"发布响应: {pub_resp.status_code}")
                print(pub_resp.text[:300])
    else:
        print(f"AI错误: {resp.status_code}")
        
except Exception as e:
    print(f"错误: {e}")
