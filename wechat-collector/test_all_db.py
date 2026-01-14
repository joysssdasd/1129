"""测试各个数据库是否加密"""
import sqlite3
import os

db_dir = r"E:\xwechat_files\wxid_yq70a2dy8yg922_ceaf\db_storage"

databases = [
    "session/session.db",
    "contact/contact.db", 
    "message/message_0.db",
    "general/general.db"
]

for db in databases:
    db_path = os.path.join(db_dir, db)
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' LIMIT 3")
            tables = cursor.fetchall()
            conn.close()
            print(f"[OK] {db}: {tables}")
        except Exception as e:
            print(f"[加密] {db}: {str(e)[:50]}")
    else:
        print(f"[不存在] {db}")
