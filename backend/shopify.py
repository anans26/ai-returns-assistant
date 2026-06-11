import os
import requests
from dotenv import load_dotenv

load_dotenv()

STORE = os.getenv("SHOPIFY_STORE")
TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN")


def get_orders():
    url = f"https://{STORE}/admin/api/2024-01/orders.json"

    headers = {
        "X-Shopify-Access-Token": TOKEN
    }

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        data = response.json()
        return data["orders"]

    print("Error:", response.text)
    return []


def get_order_by_id(order_id):
    orders = get_orders()

    for order in orders:
        if str(order["id"]) == str(order_id):
            return order

    return None


def verify_order(order_id, email):
    order = get_order_by_id(order_id)

    if order is None:
        return False

    return order.get("email", "").lower() == email.lower()


def get_order_products(order_id):
    order = get_order_by_id(order_id)

    if order is None:
        return []

    print("\nNumber of line items:", len(order["line_items"]))

    products = []

    for item in order["line_items"]:
        products.append({
            "product_id": item["product_id"],
            "title": item["title"],
            "quantity": item["quantity"]
        })

    return products


if __name__ == "__main__":
    order_id = input("Enter Order ID: ")
    email = input("Enter Email: ")

    if verify_order(order_id, email):
        print("\nOrder Verified")

        products = get_order_products(order_id)

        print("\nProducts in Order:")
        for index, product in enumerate(products, start=1):
            print(
                f"{index}. {product['title']} "
                f"(Qty: {product['quantity']})"
            )

    else:
        print("\nVerification Failed")