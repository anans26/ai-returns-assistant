import os
import requests
from dotenv import load_dotenv
from datetime import datetime, timezone
from database import get_rule, create_return_request, initialize_db

load_dotenv()

STORE = os.getenv("SHOPIFY_STORE")
TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN")
API_VERSION = "2025-01"


def get_orders():
    url = f"https://{STORE}/admin/api/{API_VERSION}/orders.json"

    headers = {
        "X-Shopify-Access-Token": TOKEN
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get("orders", [])
        
        print(f"API Error (Status {response.status_code}): {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"Network error trying to fetch orders: {e}")
    
    return []


def get_order_by_id(order_id):
    url = f"https://{STORE}/admin/api/{API_VERSION}/orders/{order_id}.json"

    headers = {
        "X-Shopify-Access-Token": TOKEN
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json().get("order")
        
        if response.status_code == 404:
            print(f"Order with ID {order_id} not found.")
        else:
            print(f"API Error (Status {response.status_code}): {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"Network error trying to fetch order {order_id}: {e}")
        
    return None


def verify_order(order, email):
    if order is None:
        return False

    return order.get("email", "").lower() == email.lower()


def get_order_products(order):
    if order is None:
        return []

    products = []

    for item in order.get("line_items", []):
        products.append({
            "line_item_id": str(item.get("id")),
            "product_id": str(item.get("product_id")),
            "variant_id": str(item.get("variant_id")),
            "variant_title": item.get("variant_title"),
            "title": item.get("title"),
            "quantity": item.get("quantity")
        })

    return products


def check_return_eligibility(order):
    if not order:
        return False

    try:
        # Parse timezone-aware ISO 8601 string from Shopify
        order_date = datetime.fromisoformat(order["created_at"])
        today = datetime.now(timezone.utc)
        
        days_since_order = (today - order_date).days
        
        rule_val = get_rule("return_window_days")
        if rule_val is None:
            print("Warning: return_window_days rule not found in database. Defaulting to 30 days.")
            return_window = 30
        else:
            return_window = int(rule_val)

        print("\nOrder Timestamp:", order_date)
        print("Current Time (UTC):", today)
        print("Days Since Order:", days_since_order)
        print("Return Window (Days):", return_window)

        return days_since_order <= return_window
    except Exception as e:
        print(f"Error checking return eligibility: {e}")
        return False


def prompt_integer(prompt_text, min_val=None, max_val=None):
    while True:
        user_input = input(prompt_text).strip()
        try:
            val = int(user_input)
            if min_val is not None and val < min_val:
                print(f"Error: Value must be at least {min_val}.")
                continue
            if max_val is not None and val > max_val:
                print(f"Error: Value cannot exceed {max_val}.")
                continue
            return val
        except ValueError:
            print("Error: Please enter a valid integer.")


def prompt_options(prompt_title, options):
    print(f"\n{prompt_title}:")
    for i, opt in enumerate(options, 1):
        print(f"{i}. {opt}")
    
    choice = prompt_integer(f"Select an option (1-{len(options)}): ", 1, len(options))
    return choice


if __name__ == "__main__":
    # Ensure database is initialized
    try:
        initialize_db()
    except Exception as e:
        print(f"\nWarning: Auto-initialization of DB schema failed. Attempting to proceed. Details: {e}")

    order_id = input("\nEnter Order ID: ").strip()
    email = input("Enter Email: ").strip()

    if not order_id or not email:
        print("Error: Order ID and Email are required.")
        exit(1)

    # Fetch the order once
    print("\nFetching order from Shopify...")
    order = get_order_by_id(order_id)

    if order and verify_order(order, email):
        print("\nOrder Verified Successfully")

        if check_return_eligibility(order):
            print("Return Window Status: Eligible")

            products = get_order_products(order)
            if not products:
                print("No items found in this order to return.")
                exit(0)

            print("\nProducts in Order:")
            for index, product in enumerate(products, start=1):
                print(f"{index}. {product['title']}")
                if product.get('variant_title'):
                    print(f"   Variant: {product['variant_title']}")
                print(f"   Qty: {product['quantity']}")

            selected = prompt_integer(f"\nSelect Product Number (1-{len(products)}): ", 1, len(products))
            chosen_product = products[selected - 1]

            print(f"\nSelected Product: {chosen_product['title']}")
            if chosen_product.get('variant_title'):
                print("Variant:", chosen_product["variant_title"])
            print("Ordered Quantity:", chosen_product["quantity"])

            # Quantity Selection
            return_qty = prompt_integer(
                f"Enter Quantity to Return (1-{chosen_product['quantity']}): ", 
                1, 
                chosen_product["quantity"]
            )

            # Return Type Selection
            type_options = ["Refund", "Exchange", "Store Credit"]
            type_choice = prompt_options("Select Return Resolution", type_options)
            return_type = type_options[type_choice - 1].lower().replace(" ", "_")

            # Return Reason Selection
            reason_options = [
                "Damaged Product", 
                "Wrong Size", 
                "Wrong Item Received", 
                "Changed Mind", 
                "Other"
            ]
            reason_choice = prompt_options("Select Return Reason", reason_options)
            return_reason = reason_options[reason_choice - 1].lower().replace(" ", "_")

            print("\nSubmitting return request...")
            try:
                # Save Return Request to Database
                return_id = create_return_request(
                    order_id=str(order["id"]),
                    order_name=order.get("name", str(order["id"])),
                    customer_email=order.get("email"),
                    line_item_id=chosen_product["line_item_id"],
                    product_id=chosen_product["product_id"],
                    variant_id=chosen_product["variant_id"],
                    product_title=chosen_product["title"],
                    variant_title=chosen_product.get("variant_title"),
                    quantity=return_qty,
                    return_type=return_type,
                    return_reason=return_reason
                )
                print("\n=============================================")
                print("SUCCESS: Return request saved successfully.")
                print(f"Return Tracking ID: {return_id}")
                print(f"Order: {order.get('name', order_id)}")
                print(f"Item: {chosen_product['title']} (Qty: {return_qty})")
                print(f"Resolution: {return_type.upper()}")
                print(f"Reason: {return_reason.replace('_', ' ').capitalize()}")
                print("=============================================")
            except Exception as e:
                print(f"\nDatabase Error: Failed to save return request. Please try again later.")
                print(f"Error Details: {e}")

        else:
            print("Return Window Status: Expired. This order is past the eligible return window.")

    else:
        print("Verification Failed: Invalid Order ID or Email.")