CREATE TABLE verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(6) NOT NULL,
    phone VARCHAR(11) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);