CREATE TABLE view_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    post_id UUID NOT NULL,
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    is_deal_confirmed BOOLEAN,
    deal_confirmed_at TIMESTAMPTZ
);