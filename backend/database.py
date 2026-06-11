import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def connect_db():
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )

    return conn

def get_rule(rule_name):
    conn = connect_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT rule_value FROM rules WHERE rule_name = %s",
        (rule_name,)
    )

    result = cursor.fetchone()

    cursor.close()
    conn.close()

    if result:
        return result[0]

    return None