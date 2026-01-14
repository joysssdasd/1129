import sqlite3

db_path = r'D:\xwechat_files\wxid_yq70a2dy8yg922_ceaf\db_storage\message\message_0.db'

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print('数据库表:', tables)
    conn.close()
except Exception as e:
    print('错误:', type(e).__name__, e)
