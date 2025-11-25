CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_code VARCHAR(10) NOT NULL,
    invitee_id UUID NOT NULL,
    has_posted BOOLEAN DEFAULT false,
    reward_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);