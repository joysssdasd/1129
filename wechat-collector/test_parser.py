"""
解析器测试脚本
用于测试AI解析和简单解析的效果
"""

from src.message_parser import MessageParser, SimpleParser

# 测试数据（你提供的示例）
TEST_MESSAGES = [
    """19/克出白银银条，1000克起卖，纯度999以上，买家付全款，运费顺丰到付，要的私聊。""",
    
    """王力宏绍兴3号1080-3000（余1）1380-3500（余2加1）1680-4000（余2加2）前七排4800前三排7000前排默认1-4区""",
    
    """王力宏绍兴.4号680-2400880–26001080-2800包厢-31001380--34001680-4000（余4加1）前五排5500前三排7000一排私信前排默认1-4区无票赔付30%信息异常/重复购票30%""",
    
    """郑州王源 涵秒发31跨年包厢36501680看台13排42001680看台前5排50001980内场-5600（350号内）1号1980内场-5000内场80号×4 7500内场180号内6000880看台前八排4300880看台随机40002号 1980内场-5100""",
]


def test_simple_parser():
    """测试简单解析器"""
    print("=" * 60)
    print("简单解析器测试")
    print("=" * 60)
    
    parser = SimpleParser()
    
    for i, msg in enumerate(TEST_MESSAGES, 1):
        print(f"\n--- 测试 {i} ---")
        print(f"原文: {msg[:100]}...")
        
        items = parser.parse(msg)
        
        if items:
            print(f"解析结果 ({len(items)} 条):")
            for item in items:
                print(f"  - 标题: {item.get('title')}")
                print(f"    价格: {item.get('price')}")
                print(f"    类型: {'出售' if item.get('trade_type') == 2 else '求购'}")
        else:
            print("未解析出结果")


def test_ai_parser(api_key: str):
    """测试AI解析器"""
    print("=" * 60)
    print("AI解析器测试")
    print("=" * 60)
    
    parser = MessageParser(api_key)
    
    for i, msg in enumerate(TEST_MESSAGES, 1):
        print(f"\n--- 测试 {i} ---")
        print(f"原文: {msg[:100]}...")
        
        items = parser.parse_with_ai(msg)
        
        if items:
            print(f"解析结果 ({len(items)} 条):")
            for item in items:
                print(f"  - 标题: {item.get('title')}")
                print(f"    价格: {item.get('price')}")
                print(f"    关键词: {item.get('keywords')}")
                print(f"    类型: {'出售' if item.get('trade_type') == 2 else '求购'}")
        else:
            print("未解析出结果")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='解析器测试')
    parser.add_argument('--ai', action='store_true', help='测试AI解析器')
    parser.add_argument('--api-key', help='DeepSeek API密钥')
    
    args = parser.parse_args()
    
    # 总是测试简单解析器
    test_simple_parser()
    
    # 如果指定了AI测试
    if args.ai:
        if not args.api_key:
            print("\n请提供 --api-key 参数")
        else:
            test_ai_parser(args.api_key)
