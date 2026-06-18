"""
api.py

FastAPI REST server for the Returns Agent frontend.
Run with: uvicorn api:app --reload --port 8000
"""
import os
import json
import requests as http_requests
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict

import google.generativeai as genai
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
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
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


# ---------------------------------------------------------------------------
# Assistant chat (Gemini)
# ---------------------------------------------------------------------------

ASSISTANT_TOOLS_GEMINI = [{
    "function_declarations": [
        {
            "name": "verify_order",
            "description": "Look up a Shopify order by ID and email to verify identity and retrieve eligible products.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "string", "description": "Numeric Shopify order ID"},
                    "email": {"type": "string", "description": "Customer email address"},
                },
                "required": ["order_id", "email"],
            },
        },
        {
            "name": "submit_return",
            "description": "Submit a return request after collecting all required information from the customer.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "string"},
                    "order_name": {"type": "string"},
                    "customer_email": {"type": "string"},
                    "return_type": {"type": "string"},
                    "return_reason": {"type": "string"},
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "line_item_id": {"type": "string"},
                                "product_id": {"type": "string"},
                                "variant_id": {"type": "string"},
                                "product_title": {"type": "string"},
                                "variant_title": {"type": "string"},
                                "quantity": {"type": "integer"},
                            },
                            "required": ["line_item_id", "product_id", "variant_id", "product_title", "quantity"],
                        },
                    },
                },
                "required": ["order_id", "order_name", "customer_email", "return_type", "return_reason", "items"],
            },
        },
    ],
}]

SYSTEM_PROMPT = """You are a returns assistant for a Shopify store. Help customers initiate return requests efficiently.

Workflow:
1. If you don't have order details yet, ask for Order ID and email together in one message.
2. Call verify_order. If the order is outside the return window or not found, inform the customer clearly.
3. Present the eligible products. The UI will render them as visual cards — just say something natural like "Which item(s) would you like to return?" DO NOT list products as text.
4. Once the customer tells you which item(s) to return, ask for return type (Refund / Exchange / Store Credit) and reason (Damaged Product / Wrong Size / Wrong Item Received / Changed Mind / Other) in one message.
5. Confirm the details with the customer, then call submit_return.
6. After submission, tell the customer their return was submitted and the UI will show their confirmation.

Rules:
- Never ask for information you already have from context.
- Be concise and professional. No marketing language.
- After verify_order succeeds, include a JSON block at the END of your message in this exact format so the UI can render product cards:
  <<<PRODUCTS:{"products":[...full product objects from the tool result...]}>>>
- After submit_return succeeds, include a JSON block at the END of your message:
  <<<RETURN_CONFIRMED:{"return_id":"...","order_name":"...","items":[...]}>>>
"""


class AssistantMessage(BaseModel):
    role: str
    content: str


class AssistantChatRequest(BaseModel):
    message: str
    history: List[AssistantMessage] = []
    portal_context: Optional[Dict[str, Any]] = None


def _run_tool(name: str, inputs: dict) -> str:
    if name == "verify_order":
        order = _fetch_shopify_order(inputs["order_id"])
        if order is None:
            return json.dumps({"verified": False, "error": "Order not found."})

        if order.get("email", "").lower() != inputs["email"].lower():
            return json.dumps({"verified": False, "error": "Email does not match."})

        order_date = datetime.fromisoformat(order["created_at"])
        today = datetime.now(timezone.utc)
        days_since = (today - order_date).days
        rule_val = get_rule("return_window_days")
        window = int(rule_val) if rule_val and int(rule_val) > 0 else 30
        eligible = days_since <= window

        products = [
            {
                "line_item_id": str(item.get("id")),
                "product_id": str(item.get("product_id")),
                "variant_id": str(item.get("variant_id")),
                "variant_title": item.get("variant_title"),
                "title": item.get("title"),
                "quantity": item.get("quantity"),
                "price": item.get("price"),
                "image": item.get("image"),
            }
            for item in order.get("line_items", [])
        ]

        return json.dumps({
            "verified": True,
            "eligible": eligible,
            "days_since_order": days_since,
            "return_window_days": window,
            "order": {
                "id": str(order["id"]),
                "name": order.get("name", f"#{order['id']}"),
                "email": order.get("email"),
                "created_at": order.get("created_at"),
            },
            "products": products,
        })

    if name == "submit_return":
        items = [
            {
                "line_item_id": i["line_item_id"],
                "product_id": i["product_id"],
                "variant_id": i["variant_id"],
                "product_title": i["product_title"],
                "variant_title": i.get("variant_title"),
                "quantity": i["quantity"],
            }
            for i in inputs["items"]
        ]
        try:
            return_id = create_return_with_items(
                order_id=inputs["order_id"],
                order_name=inputs["order_name"],
                customer_email=inputs["customer_email"],
                return_type=inputs["return_type"],
                return_reason=inputs["return_reason"],
                items=items,
            )
            return json.dumps({"success": True, "return_id": return_id})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    return json.dumps({"error": f"Unknown tool: {name}"})


@app.post("/api/assistant/chat")
async def assistant_chat(req: AssistantChatRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not configured in .env")

    genai.configure(api_key=GEMINI_API_KEY)

    # Build dynamic system prompt — inject portal context so it persists across all turns
    system = SYSTEM_PROMPT
    if req.portal_context:
        ctx = req.portal_context
        if ctx.get("order_data"):
            od = ctx["order_data"]
            order = od.get("order", {})
            products = od.get("products", [])
            system += (
                f"\n\nSESSION CONTEXT (always available — never ask for this info):\n"
                f"- Order: {order.get('name', '')} (ID: {order.get('id', '')})\n"
                f"- Email: {order.get('email', '')}\n"
                f"- Eligible products: {json.dumps(products)}\n"
                f"- Return window: {od.get('return_window_days', 30)} days "
                f"(day {od.get('days_since_order', 0)} used)\n"
            )
            if ctx.get("selected_items"):
                system += f"- Customer already selected items: {json.dumps(ctx['selected_items'])}\n"
        elif ctx.get("order_id"):
            system += (
                f"\n\nSESSION CONTEXT:\n"
                f"- Customer entered Order ID: {ctx['order_id']}"
                + (f", email: {ctx['email']}" if ctx.get("email") else "")
                + " (not yet verified)\n"
            )

    # Build Gemini history (text-only turns from prior exchanges)
    gemini_history = []
    for msg in req.history:
        role = "model" if msg.role == "assistant" else "user"
        gemini_history.append({"role": role, "parts": [{"text": msg.content}]})

    user_text = req.message

    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            tools=ASSISTANT_TOOLS_GEMINI,
            system_instruction=system,
        )
        chat = model.start_chat(history=gemini_history)

        # Agentic loop
        response = chat.send_message(user_text)

        while True:
            func_calls = [
                part.function_call
                for part in response.candidates[0].content.parts
                if hasattr(part, "function_call") and part.function_call.name
            ]

            if not func_calls:
                break

            tool_response_parts = []
            for fc in func_calls:
                result_str = _run_tool(fc.name, dict(fc.args))
                result_data = json.loads(result_str)
                tool_response_parts.append(
                    genai.protos.Part(
                        function_response=genai.protos.FunctionResponse(
                            name=fc.name,
                            response={"result": result_data},
                        )
                    )
                )

            response = chat.send_message(tool_response_parts)

        text_parts = [
            part.text
            for part in response.candidates[0].content.parts
            if hasattr(part, "text") and part.text
        ]
        reply = "".join(text_parts) or "Something went wrong. Please try again."
        return {"reply": reply}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini error: {str(e)}")
