CREATE TABLE point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    change_type INTEGER NOT NULL,
    change_amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    related_id UUID,
    description VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);