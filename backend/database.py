"""
database.py

Handles all PostgreSQL interactions for the Returns Agent:
  - Database connection
  - Schema initialization and incremental migrations
  - Rules engine queries
  - Return request persistence
  - Return image metadata storage and retrieval
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()


def connect_db():
    """
    Open and return a psycopg2 connection to PostgreSQL using credentials
    from environment variables. Raises psycopg2.OperationalError on failure.
    """
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            connect_timeout=5
        )
        return conn
    except psycopg2.OperationalError as e:
        print("\n[Database Connection Error] Could not connect to PostgreSQL.")
        print(f"Details: {e}")
        print("Please verify that your database is running and credentials in .env are correct.")
        raise e


def get_rule(rule_name):
    """
    Fetch a single rule value from the rules table by name.
    Returns the rule_value string, or None if the rule does not exist.
    """
    conn = None
    cursor = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT rule_value FROM rules WHERE rule_name = %s",
            (rule_name,)
        )

        result = cursor.fetchone()
        if result:
            return result[0]

    except Exception as e:
        print(f"Error querying rule '{rule_name}': {e}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    return None


def check_table_columns(table_name):
    """
    Query information_schema to verify table existence and column types.
    Returns a dictionary of {column_name: data_type} or None if the table doesn't exist.
    """
    conn = None
    cursor = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position;
            """,
            (table_name,)
        )
        rows = cursor.fetchall()
        if not rows:
            return None
        return {row[0]: row[1] for row in rows}
    except Exception as e:
        print(f"Error inspecting database table '{table_name}': {e}")
        return None
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def create_return_request(order_id, order_name, customer_email, line_item_id, product_id, variant_id, product_title, variant_title, quantity, return_type, return_reason):
    """
    Insert a return request and its items within a database transaction.
    """
    conn = None
    cursor = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        # 1. Insert into returns table
        cursor.execute(
            """
            INSERT INTO returns (order_id, order_name, customer_email, return_status, return_type, return_reason)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (order_id, order_name, customer_email, 'requested', return_type, return_reason)
        )
        return_id = cursor.fetchone()[0]

        # 2. Insert into return_items table
        cursor.execute(
            """
            INSERT INTO return_items (return_id, line_item_id, product_id, variant_id, title, variant_title, quantity)
            VALUES (%s, %s, %s, %s, %s, %s, %s);
            """,
            (return_id, line_item_id, product_id, variant_id, product_title, variant_title, quantity)
        )

        conn.commit()
        return return_id
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error saving return request to database: {e}")
        raise e
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def create_return_with_items(order_id, order_name, customer_email, return_type, return_reason, items):
    """
    Insert a return request with multiple line items in a single transaction.

    items: list of dicts with keys:
        line_item_id, product_id, variant_id, product_title, variant_title, quantity

    Returns the return UUID as a string.
    """
    conn = None
    cursor = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO returns (order_id, order_name, customer_email, return_status, return_type, return_reason)
            VALUES (%s, %s, %s, 'requested', %s, %s)
            RETURNING id;
            """,
            (order_id, order_name, customer_email, return_type, return_reason)
        )
        return_id = cursor.fetchone()[0]

        for item in items:
            cursor.execute(
                """
                INSERT INTO return_items (return_id, line_item_id, product_id, variant_id, title, variant_title, quantity)
                VALUES (%s, %s, %s, %s, %s, %s, %s);
                """,
                (
                    return_id,
                    item["line_item_id"],
                    item["product_id"],
                    item["variant_id"],
                    item["product_title"],
                    item.get("variant_title"),
                    item["quantity"],
                )
            )

        conn.commit()
        return str(return_id)
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error saving return request to database: {e}")
        raise e
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def save_return_image(return_id, image_path):
    """
    Save an image file path associated with a return request.

    Args:
        return_id: UUID of the parent return (must exist in returns table).
        image_path: File path or URL of the uploaded image.

    Raises:
        Exception: Re-raises any database error after rollback and logging.
    """
    conn = None
    cursor = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO return_images (return_id, image_path)
            VALUES (%s, %s);
            """,
            (return_id, image_path)
        )

        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error saving return image to database: {e}")
        raise e
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def get_return_images(return_id):
    """
    Retrieve all images associated with a return request.

    Args:
        return_id: UUID of the parent return.

    Returns:
        List of dicts with keys: id, return_id, image_path, uploaded_at.
        Returns an empty list if no images exist or on error.
    """
    conn = None
    cursor = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT id, return_id, image_path, uploaded_at
            FROM return_images
            WHERE return_id = %s
            ORDER BY uploaded_at ASC;
            """,
            (str(return_id),)
        )

        rows = cursor.fetchall()
        return [
            {
                "id": str(row[0]),
                "return_id": str(row[1]),
                "image_path": row[2],
                "uploaded_at": row[3].isoformat() if row[3] else None,
            }
            for row in rows
        ]
    except Exception as e:
        print(f"Error retrieving images for return '{return_id}': {e}")
        return []
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def delete_return_image(image_id):
    """
    Delete a single image record from the return_images table.

    Args:
        image_id: UUID of the image row to delete.

    Returns:
        True if a row was deleted, False if no matching row was found.

    Raises:
        Exception: Re-raises any database error after rollback and logging.
    """
    conn = None
    cursor = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        cursor.execute(
            "DELETE FROM return_images WHERE id = %s;",
            (str(image_id),)
        )

        deleted = cursor.rowcount > 0
        conn.commit()
        return deleted
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error deleting return image '{image_id}': {e}")
        raise e
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def initialize_db():
    """
    Run migration queries to initialize or update tables incrementally.
    """
    print("\nInitializing database schema and checking tables...")
    conn = None
    cursor = None
    try:
        conn = connect_db()
        cursor = conn.cursor()

        # Enable UUID extension
        cursor.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")

        # 1. Rules Table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS rules (
                id SERIAL PRIMARY KEY,
                rule_name VARCHAR(100) UNIQUE NOT NULL,
                rule_value TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            """
        )

        # 2. Returns Table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS returns (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                order_id VARCHAR(100) NOT NULL,
                order_name VARCHAR(100) NOT NULL,
                customer_email VARCHAR(255) NOT NULL,
                return_type VARCHAR(50) NOT NULL,
                return_reason VARCHAR(255) NOT NULL,
                return_status VARCHAR(50) NOT NULL DEFAULT 'requested',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            """
        )

        # 3. Return Items Table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS return_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
                line_item_id VARCHAR(100) NOT NULL,
                product_id VARCHAR(100) NOT NULL,
                variant_id VARCHAR(100) NOT NULL,
                title VARCHAR(255) NOT NULL,
                variant_title VARCHAR(255),
                quantity INT NOT NULL CHECK (quantity > 0),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_return_line_item UNIQUE (return_id, line_item_id)
            );
            """
        )

        # Incremental migrations: check for missing columns and apply alter statements
        # Table 'returns' updates
        returns_cols = check_table_columns("returns")
        if returns_cols:
            if "order_name" not in returns_cols:
                print("Migration: Adding 'order_name' to table 'returns'...")
                cursor.execute("ALTER TABLE returns ADD COLUMN order_name VARCHAR(100);")
            if "return_reason" not in returns_cols:
                print("Migration: Adding 'return_reason' to table 'returns'...")
                cursor.execute("ALTER TABLE returns ADD COLUMN return_reason VARCHAR(255);")
            if "return_type" not in returns_cols:
                print("Migration: Adding 'return_type' to table 'returns'...")
                cursor.execute("ALTER TABLE returns ADD COLUMN return_type VARCHAR(50);")
            if "return_status" not in returns_cols:
                print("Migration: Adding 'return_status' to table 'returns'...")
                cursor.execute("ALTER TABLE returns ADD COLUMN return_status VARCHAR(50) DEFAULT 'requested';")
            
        # Table 'return_items' updates
        items_cols = check_table_columns("return_items")
        if items_cols:
            if "line_item_id" not in items_cols:
                print("Migration: Adding 'line_item_id' to table 'return_items'...")
                cursor.execute("ALTER TABLE return_items ADD COLUMN line_item_id VARCHAR(100) NOT NULL;")

        # 4. Return Images Table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS return_images (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                return_id   UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
                image_path  TEXT NOT NULL,
                uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
            );
            """
        )

        # Create Indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rules_name ON rules(rule_name);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns(order_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_returns_customer_email ON returns(customer_email);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_return_items_variant_id ON return_items(variant_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_return_images_return_id ON return_images(return_id);")

        # Seed Default Rules
        cursor.execute(
            """
            INSERT INTO rules (rule_name, rule_value, description)
            VALUES 
            ('return_window_days', '30', 'Number of days from order creation when items can be returned.'),
            ('allow_exchange', 'true', 'Enable exchange returns resolution.'),
            ('allow_store_credit', 'true', 'Enable store credit returns resolution.')
            ON CONFLICT (rule_name) DO NOTHING;
            """
        )

        conn.commit()
        print("Database initialized successfully.")
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error initializing database schema: {e}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


if __name__ == "__main__":
    try:
        initialize_db()
        
        # Display schema status
        for table in ["rules", "returns", "return_items", "return_images"]:
            cols = check_table_columns(table)
            if cols:
                print(f"\nTable '{table}' exists with columns:")
                for col, dtype in cols.items():
                    print(f" - {col}: {dtype}")
            else:
                print(f"\nTable '{table}' does not exist.")
    except Exception:
        print("\nDatabase initialization failed. Check your environment settings.")