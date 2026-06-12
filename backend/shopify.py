import os
import requests
from dotenv import load_dotenv
from datetime import datetime
from database import get_rule

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
    url = f"https://{STORE}/admin/api/2024-01/orders/{order_id}.json"

    headers = {
        "X-Shopify-Access-Token": TOKEN
    }

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        return response.json()["order"]

    print("Error:", response.text)
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

    products = []

    for item in order["line_items"]:
        products.append({
            "product_id": item["product_id"],
            "title": item["title"],
            "quantity": item["quantity"]
        })

    return products


def check_return_eligibility(order_id):
    order = get_order_by_id(order_id)

    if not order:
        return False

    order_date = datetime.strptime(
        order["created_at"][:10],
        "%Y-%m-%d"
    )

    today = datetime.now()

    days_since_order = (today - order_date).days

    return_window = int(
        get_rule("return_window_days")
    )

    print("Order Date:", order_date.date())
    print("Days Since Order:", days_since_order)
    print("Return Window:", return_window)

    return days_since_order <= return_window



if __name__ == "__main__":
    
    order_id = input("Enter Order ID: ")
    email = input("Enter Email: ")

    if verify_order(order_id, email):

        print("\nOrder Verified")

        if check_return_eligibility(order_id):

            print("Return Eligible")

            products = get_order_products(order_id)

            print("\nProducts in Order:")

            for index, product in enumerate(products, start=1):
                print(
                    f"{index}. {product['title']} "
                    f"(Qty: {product['quantity']})"
                )

            selected = int(input("\nSelect Product Number: "))

            chosen_product = products[selected - 1]

            print("\nSelected Product:")
            print(chosen_product["title"])
            print("Quantity:", chosen_product["quantity"])

        else:
            print("Return Window Expired")

    else:
        print("Verification Failed")

    