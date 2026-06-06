import argparse
import base64
import hashlib
import json
import pathlib
import sqlite3
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

OUT = sys.stdout


def pack_value(value):
    if value is None:
        return None
    if isinstance(value, bytes):
        return {"kind": "bytes", "base64": base64.b64encode(value).decode("ascii")}
    return {"kind": "text", "text": str(value)}


def load_contact_names(account_dir):
    contact_db = account_dir / "contact.db"
    names = {}
    if not contact_db.exists():
        return names

    try:
        con = sqlite3.connect(f"file:{contact_db}?mode=ro", uri=True)
        cur = con.cursor()
        for username, remark, nick_name in cur.execute(
            "select username, remark, nick_name from contact"
        ):
            names[username] = (remark or nick_name or username or "").strip()
        con.close()
    except Exception:
        return names

    return names


def emit(payload):
    OUT.write(json.dumps(payload, ensure_ascii=False))
    OUT.write("\n")


def table_exists(cur, table_name):
    return (
        cur.execute(
            "select 1 from sqlite_master where type='table' and name=? limit 1",
            (table_name,),
        ).fetchone()
        is not None
    )


def is_message_db(path):
    suffix = path.stem.removeprefix("message_")
    return suffix.isdigit()


def dump_account(account_dir, since):
    contact_names = load_contact_names(account_dir)
    for db_path in sorted(path for path in account_dir.glob("message_*.db") if is_message_db(path)):
        try:
            con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            cur = con.cursor()
            name_rows = cur.execute(
                "select rowid, user_name, is_session from Name2Id"
            ).fetchall()
        except Exception as exc:
            emit(
                {
                    "kind": "error",
                    "account": account_dir.name,
                    "db": db_path.name,
                    "error": str(exc),
                }
            )
            continue

        id_to_name = {int(rowid): username for rowid, username, _ in name_rows}
        sessions = [
            username
            for _, username, is_session in name_rows
            if int(is_session or 0) == 1 and str(username).endswith("@chatroom")
        ]

        for session in sessions:
            table_name = "Msg_" + hashlib.md5(session.encode("utf-8")).hexdigest()
            if not table_exists(cur, table_name):
                continue

            query = (
                f'select local_id, server_id, local_type, sort_seq, real_sender_id, '
                f'create_time, message_content, compress_content from "{table_name}"'
            )
            params = []
            query += " where local_type = 1"
            if since:
                query += " and create_time >= ?"
                params.append(int(since))
            query += " order by create_time asc"

            try:
                rows = cur.execute(query, params)
                for (
                    local_id,
                    server_id,
                    local_type,
                    sort_seq,
                    real_sender_id,
                    create_time,
                    message_content,
                    compress_content,
                ) in rows:
                    sender = id_to_name.get(int(real_sender_id or 0), "")
                    payload = {
                        "kind": "message",
                        "account": account_dir.name,
                        "db": db_path.name,
                        "session": session,
                        "sessionName": contact_names.get(session) or session,
                        "table": table_name,
                        "localId": local_id,
                        "serverId": str(server_id or ""),
                        "localType": local_type,
                        "sortSeq": sort_seq,
                        "senderUsername": sender,
                        "senderDisplayName": contact_names.get(sender) or sender,
                        "createTime": create_time,
                        "messageContent": pack_value(message_content),
                        "compressContent": pack_value(compress_content),
                    }
                    emit(payload)
            except Exception as exc:
                emit(
                    {
                        "kind": "error",
                        "account": account_dir.name,
                        "db": db_path.name,
                        "session": session,
                        "table": table_name,
                        "error": str(exc),
                    }
                )

        con.close()


def main():
    global OUT
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-root", required=True)
    parser.add_argument("--since", type=int, default=0)
    parser.add_argument("--output-jsonl", default="")
    args = parser.parse_args()

    root = pathlib.Path(args.db_root)
    if not root.exists():
        return 0

    output_handle = None
    if args.output_jsonl:
        output_path = pathlib.Path(args.output_jsonl)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_handle = output_path.open("w", encoding="utf-8", newline="\n")
        OUT = output_handle

    account_dirs = [
        item
        for item in root.iterdir()
        if item.is_dir() and any(is_message_db(path) for path in item.glob("message_*.db"))
    ]

    if not account_dirs and any(is_message_db(path) for path in root.glob("message_*.db")):
        account_dirs = [root]

    try:
        for account_dir in account_dirs:
            dump_account(account_dir, args.since)
    finally:
        if output_handle:
            output_handle.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
