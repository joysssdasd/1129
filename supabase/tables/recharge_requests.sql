CREATE TABLE recharge_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    points INTEGER NOT NULL,
    screenshot_url TEXT,
    status INTEGER DEFAULT 0,
    admin_id UUID,
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);