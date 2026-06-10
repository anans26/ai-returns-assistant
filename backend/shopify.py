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

    print("Status:", response.status_code)

    if response.status_code == 200:
        data = response.json()
        print(f"Orders Found: {len(data['orders'])}")

        if data["orders"]:
            order = data["orders"][0]

            print("\nFirst Order:")
            print("Order ID:", order["id"])
            print("Email:", order.get("email"))
            print("Created At:", order["created_at"])

    else:
        print(response.text)


if __name__ == "__main__":
    get_orders()