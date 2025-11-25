CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(100) NOT NULL,
    keywords VARCHAR(200) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    trade_type INTEGER NOT NULL,
    delivery_date DATE,
    extra_info VARCHAR(100),
    view_limit INTEGER DEFAULT 10,
    view_count INTEGER DEFAULT 0,
    deal_count INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1,
    expire_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);