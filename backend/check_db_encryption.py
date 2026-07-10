import sqlite3
import os

DB_PATH = "signal_clone.db"

def main():
    if not os.path.exists(DB_PATH):
        print(f"❌ Database file '{DB_PATH}' not found. Please run seed.py or start the backend first.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id, conversation_id, sender_id, type, content, is_deleted FROM messages LIMIT 15;")
        rows = cursor.fetchall()

        print("\n🔒 RAW MESSAGES STORED IN SQLITE DATABASE:")
        print("=" * 90)
        print(f"{'Message ID':<38} | {'Type':<8} | {'Raw Content (Stored in DB)'}")
        print("=" * 90)

        for row in rows:
            msg_id, conv_id, sender_id, msg_type, content, is_deleted = row
            if is_deleted:
                display_content = "[Deleted]"
            elif msg_type == 'system':
                display_content = f"{content} (System Log)"
            elif content:
                # Truncate content to keep formatting clean
                display_content = content[:60] + "..." if len(content) > 60 else content
            else:
                display_content = "[No Content]"

            print(f"{msg_id:<38} | {msg_type:<8} | {display_content}")

        print("=" * 90)
        print("\n💡 Notice that all user text messages are stored as encrypted ciphertext (starting with 'U2FsdGVkX1...')")
        print("   while system messages remain in plain text so the database is readable but completely private.\n")

    except Exception as e:
        print(f"❌ Error querying database: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
