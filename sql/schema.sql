-- Database Schema for Returns Assistant Agent

-- 1. Rules Table
CREATE TABLE IF NOT EXISTS rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) UNIQUE NOT NULL,
    rule_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Returns Table (UUIDs used for public security tracking)
CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(100) NOT NULL,
    order_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    return_type VARCHAR(50) NOT NULL,
    return_reason VARCHAR(255) NOT NULL,
    return_status VARCHAR(50) NOT NULL DEFAULT 'requested', -- requested, approved, rejected, received, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Return Items Table
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

-- 4. Indexes for performance and lookup
CREATE INDEX IF NOT EXISTS idx_rules_name ON rules(rule_name);
CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_customer_email ON returns(customer_email);
CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_variant_id ON return_items(variant_id);

-- 5. Return Images Table
-- Stores file paths for customer-uploaded images associated with a return request.
CREATE TABLE IF NOT EXISTS return_images (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id   UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    image_path  TEXT NOT NULL,
    uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_return_images_return_id ON return_images(return_id);
