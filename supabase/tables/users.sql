CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(11) UNIQUE NOT NULL,
    wechat_id VARCHAR(50) NOT NULL,
    invite_code VARCHAR(10) UNIQUE,
    invited_by VARCHAR(10),
    points INTEGER DEFAULT 100,
    deal_rate DECIMAL(5,2) DEFAULT 0.00,
    total_posts INTEGER DEFAULT 0,
    total_deals INTEGER DEFAULT 0,
    total_invites INTEGER DEFAULT 0,
    is_admin BOOLEAN DEFAULT false,
    status INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);