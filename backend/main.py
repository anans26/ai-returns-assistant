from database import connect_db
from database import get_rule

try:
    conn = connect_db()
    print("Database Connected Successfully")
    conn.close()

except Exception as e:
    print("Database Connection Failed")
    print(e)



print("Return Window:", get_rule("return_window_days"))
print("Allow Exchange:", get_rule("allow_exchange"))
print("Allow Store Credit:", get_rule("allow_store_credit"))