"""
api.py

FastAPI REST server for the Returns Agent frontend.
Run with: uvicorn api:app --reload --port 8000
"""
import os
import requests as http_requests
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from database import get_rule, create_return_with_items
from image_service import upload_return_image, ImageValidationError

load_dotenv()

STORE = os.getenv("SHOPIFY_STORE")
TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN")
API_VERSION = "2025-01"

app = FastAPI(title="Returns Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class VerifyOrderRequest(BaseModel):
    order_id: str
    email: str


class ReturnItem(BaseModel):
    line_item_id: str
    product_id: str
    variant_id: str
    product_title: str
    variant_title: Optional[str] = None
    quantity: int


class SubmitReturnRequest(BaseModel):
    order_id: str
    order_name: str
    customer_email: str
    return_type: str
    return_reason: str
    items: List[ReturnItem]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fetch_shopify_order(order_id: str):
    if not STORE or not TOKEN:
        return None
    url = f"https://{STORE}/admin/api/{API_VERSION}/orders/{order_id}.json"
    headers = {"X-Shopify-Access-Token": TOKEN}
    try:
        resp = http_requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            return resp.json().get("order")
        return None
    except http_requests.exceptions.RequestException:
        return None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/api/verify-order")
async def verify_order(req: VerifyOrderRequest):
    if not STORE or not TOKEN:
        raise HTTPException(
            status_code=503,
            detail="Shopify credentials are not configured on the server."
        )

    order = _fetch_shopify_order(req.order_id)
    if order is None:
        return JSONResponse(content={
            "verified": False,
            "error": "No order found with that ID. Please check and try again."
        })

    if order.get("email", "").lower() != req.email.lower():
        return JSONResponse(content={
            "verified": False,
            "error": "The email address doesn’t match this order."
        })

    # Eligibility
    order_date = datetime.fromisoformat(order["created_at"])
    today = datetime.now(timezone.utc)
    days_since_order = (today - order_date).days

    rule_val = get_rule("return_window_days")
    return_window = int(rule_val) if rule_val and int(rule_val) > 0 else 30
    eligible = days_since_order <= return_window

    # Line items
    products = []
    for item in order.get("line_items", []):
        products.append({
            "line_item_id": str(item.get("id")),
            "product_id": str(item.get("product_id")),
            "variant_id": str(item.get("variant_id")),
            "variant_title": item.get("variant_title"),
            "title": item.get("title"),
            "quantity": item.get("quantity"),
            "price": item.get("price"),
        })

    return {
        "verified": True,
        "order": {
            "id": str(order["id"]),
            "name": order.get("name", f"#{order['id']}"),
            "email": order.get("email"),
            "created_at": order.get("created_at"),
        },
        "eligible": eligible,
        "days_since_order": days_since_order,
        "return_window_days": return_window,
        "products": products,
    }


@app.get("/api/rules")
async def get_rules():
    allow_exchange = get_rule("allow_exchange")
    allow_store_credit = get_rule("allow_store_credit")
    return_window = get_rule("return_window_days")
    return {
        "allow_exchange": allow_exchange == "true",
        "allow_store_credit": allow_store_credit == "true",
        "return_window_days": int(return_window) if return_window else 30,
    }


@app.post("/api/submit-return")
async def submit_return(req: SubmitReturnRequest):
    if not req.items:
        raise HTTPException(status_code=400, detail="At least one item must be selected.")

    items = [item.model_dump() for item in req.items]
    try:
        return_id = create_return_with_items(
            order_id=req.order_id,
            order_name=req.order_name,
            customer_email=req.customer_email,
            return_type=req.return_type,
            return_reason=req.return_reason,
            items=items,
        )
        return {"success": True, "return_id": return_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save return: {str(e)}")


@app.post("/api/upload-image/{return_id}")
async def upload_image(return_id: str, file: UploadFile = File(...)):
    content = await file.read()
    try:
        result = upload_return_image(return_id, content, file.filename)
        return result
    except ImageValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")
