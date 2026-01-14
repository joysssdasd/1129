"""测试微信数据库访问"""
import sqlite3
import os

db_path = r"E:\xwechat_files\wxid_yq70a2dy8yg922_ceaf\db_storage\message\message_0.db"

print(f"数据库路径: {db_path}")
print(f"文件存在: {os.path.exists(db_path)}")
print(f"文件大小: {os.path.getsize(db_path) / 1024 / 1024:.2f} MB")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 获取所有表
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print(f"\n数据库表: {tables}")
    
    # 尝试读取一条消息
    if tables:
        for table in tables:
            table_name = table[0]
            try:
                cursor.execute(f"SELECT * FROM {table_name} LIMIT 1")
                row = cursor.fetchone()
                print(f"\n表 {table_name} 示例数据: {row[:3] if row else 'empty'}...")
            except Exception as e:
                print(f"读取表 {table_name} 失败: {e}")
    
    conn.close()
    print("\n数据库可以正常访问！")
    
except sqlite3.DatabaseError as e:
    print(f"\n数据库错误（可能已加密）: {e}")
except Exception as e:
    print(f"\n其他错误: {e}")
