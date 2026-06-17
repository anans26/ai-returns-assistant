# Shopify Returns Agent

A return request collection and validation system. Customers verify their order, select items to return, provide a reason, and optionally upload images. Requests are stored in PostgreSQL. **No refunds, exchanges, or order changes are made automatically.**

## Architecture

```
frontend/    React + Vite + Tailwind (4-screen flow)
backend/     FastAPI REST server + business logic
             └── shopify.py       CLI entrypoint (legacy)
             └── api.py           HTTP API server (new)
             └── database.py      PostgreSQL helpers
             └── image_service.py Image upload pipeline
sql/         Schema reference
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- Docker (for PostgreSQL via docker-compose)
- A Shopify store with an Admin API access token

## Setup

### 1. Configure backend environment

Create `backend/.env`:

```env
SHOPIFY_STORE=yourstore.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxx

DB_HOST=localhost
DB_PORT=5432
DB_NAME=returns_db
DB_USER=admin
DB_PASSWORD=admin
```

### 2. Start PostgreSQL

```bash
cd backend
docker-compose up -d
```

### 3. Initialize the database schema

```bash
cd backend
python database.py
```

### 4. Install and start the backend API

```bash
cd backend
pip install -r requirements.txt
uvicorn api:app --reload --port 8000
```

The API runs at http://localhost:8000. Available routes:
- `POST /api/verify-order` — verify order ID + email, return eligibility + line items
- `GET  /api/rules` — return window + allowed return types
- `POST /api/submit-return` — create a return request in the DB
- `POST /api/upload-image/{return_id}` — attach an image to a return

### 5. Install and start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` requests to `http://localhost:8000` automatically.

## Frontend flow

| Step | Screen | Description |
|------|--------|-------------|
| 1 | Order Verification | Enter order ID and email; backend verifies against Shopify |
| 2 | Product Selection | Choose which items to return and quantity |
| 3 | Return Details | Select return type, reason, and upload images if required |
| 4 | Confirmation | Summary of what was submitted; no order changes made |

## Image upload rules

- Max **5 images** per return
- Max **10 MB** per image
- Accepted formats: JPG, JPEG, PNG, WebP
- Images are required for **Damaged Product** and **Wrong Item Received** reasons
- Images are validated client-side before upload and again server-side
